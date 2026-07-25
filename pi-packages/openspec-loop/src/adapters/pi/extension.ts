/**
 * Pi package: full OpenSpec plan → controlled apply loop.
 *
 * Commands:
 *   /openspec-feature [desc]  — plan with OpenSpec, then apply with model/gates loop
 *   /openspec-plan [desc]     — planning only (proposal/specs/design/tasks)
 *   /openspec-loop [change]   — apply loop only (templates + models + gates)
 *   /openspec-loop-save|runs|status|stop
 */

import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  assessPlanReadiness,
  buildProposePrompt,
  createRuntimeState,
  createWorkflowState,
  describeMode,
  ensureOpenspecProject,
  formatPlanReadiness,
  formatRunSetup,
  handleApplyLoopTick,
  handleStopGate,
  listRunTemplates,
  loadChangeState,
  loadConfig,
  openspecCliAvailable,
  parseModelRef,
  prepareRunSetup,
  resetWorkflow,
  resolveChangeName,
  saveLastRun,
  saveRunSetup,
  slugifyChangeName,
  type FeaturePath,
  type HarnessAdapter,
  type LoopConfig,
  type LoopRuntimeState,
  type RunSetup,
  type WorkflowState,
} from "../../core/index.js";
import { runReviewAgent } from "./review-agent.js";

function formatModel(model: { provider: string; id: string } | undefined | null): string | null {
  if (!model) return null;
  return `${model.provider}/${model.id}`;
}

function createPiAdapter(pi: ExtensionAPI, ctx: ExtensionContext): HarnessAdapter {
  return {
    cwd: ctx.cwd,
    notify(message, type = "info") {
      ctx.ui.notify(message, type);
    },
    setStatus(key, text) {
      ctx.ui.setStatus(key, text);
    },
    async select(title, options) {
      if (!ctx.hasUI) return options[0];
      return ctx.ui.select(title, options);
    },
    async confirm(title, message) {
      if (!ctx.hasUI) return true;
      return ctx.ui.confirm(title, message);
    },
    async input(title, placeholder) {
      if (!ctx.hasUI) return placeholder;
      return ctx.ui.input(title, placeholder);
    },
    async exec(command, args, opts) {
      const result = await pi.exec(command, args, {
        cwd: opts?.cwd ?? ctx.cwd,
        timeout: opts?.timeoutMs,
      });
      return {
        code: result.code ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    },
    async shell(command, opts) {
      const result = await pi.exec("/bin/bash", ["-c", command], {
        cwd: opts?.cwd ?? ctx.cwd,
        timeout: opts?.timeoutMs,
      });
      return {
        code: result.code ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    },
    followUp(content) {
      pi.sendMessage(
        {
          customType: "openspec-loop",
          content,
          display: true,
        },
        { triggerTurn: true, deliverAs: "followUp" },
      );
    },
    async prompt(content) {
      pi.sendUserMessage(content);
    },
    listModels() {
      return ctx.modelRegistry.getAvailable().map((m) => `${m.provider}/${m.id}`);
    },
    getCurrentModel() {
      return formatModel(ctx.model);
    },
    async setMainModel(ref) {
      const parsed = parseModelRef(ref);
      if (!parsed) return { ok: false, error: `Expected provider/id, got: ${ref}` };
      const model = ctx.modelRegistry.find(parsed.provider, parsed.id);
      if (!model) return { ok: false, error: `Model not found: ${ref}` };
      const ok = await pi.setModel(model);
      if (!ok) return { ok: false, error: `No API key / failed to switch to ${ref}` };
      return { ok: true };
    },
    async runReviewAgent(opts) {
      return runReviewAgent({ ...opts, cwd: ctx.cwd });
    },
  };
}

async function pickChange(
  adapter: HarnessAdapter,
  configured: string,
  argChange?: string,
): Promise<string | null> {
  const wanted = argChange?.trim() || configured;
  const resolved = await resolveChangeName(adapter, wanted || "auto");
  if (resolved.change) return resolved.change;
  if (resolved.error) {
    adapter.notify(resolved.error, "error");
    return null;
  }
  if (resolved.candidates.length === 0) {
    adapter.notify("No OpenSpec changes found.", "error");
    return null;
  }
  const choice = await adapter.select("Select OpenSpec change", resolved.candidates);
  return choice ?? null;
}

function applyThinkingLevel(pi: ExtensionAPI, setup: RunSetup): void {
  if (!setup.thinking_level) return;
  try {
    pi.setThinkingLevel(setup.thinking_level);
  } catch {
    /* ignore */
  }
}

async function pickFeaturePath(adapter: HarnessAdapter): Promise<FeaturePath | null> {
  const choice = await adapter.select("openspec-feature path", [
    "Full — plan with OpenSpec, then apply with controlled loop",
    "Plan only — create proposal/specs/design/tasks",
    "Apply only — existing change + model/gates loop",
  ]);
  if (!choice) return null;
  if (choice.startsWith("Plan only")) return "plan-only";
  if (choice.startsWith("Apply only")) return "apply-only";
  return "full";
}

async function resolveNewChangeId(
  adapter: HarnessAdapter,
  args: string,
): Promise<{ change: string; description: string } | null> {
  let description = args.trim();
  if (!description && adapter.input) {
    description = (await adapter.input("What feature/change?", "add-dark-mode"))?.trim() || "";
  }
  if (!description) {
    adapter.notify("Provide a change description, e.g. /openspec-feature add dark mode", "warning");
    return null;
  }

  let change = slugifyChangeName(description);
  if (adapter.input) {
    const typed = await adapter.input("Change id (kebab-case)", change);
    if (typed?.trim()) change = slugifyChangeName(typed);
  } else {
    const ok = adapter.confirm
      ? await adapter.confirm("Use this change id?", change)
      : true;
    if (!ok) return null;
  }
  return { change, description };
}

export default function (pi: ExtensionAPI): void {
  let config: LoopConfig = loadConfig(process.cwd()).config;
  let runtime: LoopRuntimeState | null = null;
  let workflow: WorkflowState = createWorkflowState();
  let handlingEnd = false;

  async function startApplyPhase(
    adapter: HarnessAdapter,
    ctx: ExtensionCommandContext | ExtensionContext,
    change: string,
  ): Promise<void> {
    const loaded = loadConfig(adapter.cwd);
    config = loaded.config;

    const readiness = await assessPlanReadiness(adapter, change);
    if (!readiness.ready) {
      const proceed = adapter.confirm
        ? await adapter.confirm(
            "Plan looks incomplete. Start apply anyway?",
            formatPlanReadiness(readiness),
          )
        : false;
      if (!proceed) {
        adapter.notify("Apply cancelled. Finish planning first (/openspec-plan).", "warning");
        workflow.phase = "awaiting_apply";
        return;
      }
    }

    const prepared = await prepareRunSetup(adapter, config, { change });
    if (!prepared) {
      workflow.phase = "awaiting_apply";
      return;
    }

    config = prepared.config;
    applyThinkingLevel(pi, prepared.setup);
    runtime = createRuntimeState(prepared.setup.mode, change, prepared.setup);
    workflow.phase = "applying";
    workflow.setup = prepared.setup;
    workflow.mode = prepared.setup.mode;
    workflow.change = change;

    const state = await loadChangeState(adapter, change);
    adapter.notify(
      [
        "APPLY phase started (controlled loop)",
        describeMode(prepared.setup.mode),
        `change: ${change}`,
        `main_model: ${prepared.setup.main_model}`,
        `tasks: ${state.complete}/${state.total} done`,
        formatRunSetup(prepared.setup),
      ].join("\n"),
      "info",
    );

    if (prepared.setup.mode === "apply-loop") {
      const result = await handleApplyLoopTick(adapter, config, runtime);
      if (result === "halted" && "shutdown" in ctx) ctx.shutdown();
    } else {
      adapter.notify(
        "stop-gate armed. Work normally; gates run when you stop.",
        "info",
      );
    }
  }

  async function startPlanPhase(
    adapter: HarnessAdapter,
    change: string,
    description: string,
    continueToApply: boolean,
  ): Promise<void> {
    const ensured = await ensureOpenspecProject(adapter);
    adapter.notify(ensured.detail, ensured.ok ? "info" : "error");
    if (!ensured.ok) return;

    const hasCli = await openspecCliAvailable(adapter);
    workflow.phase = "planning";
    workflow.change = change;
    workflow.description = description;
    workflow.continueToApply = continueToApply;

    adapter.notify(
      [
        "PLAN phase started (OpenSpec artifacts only — no feature code yet)",
        `change: ${change}`,
        continueToApply
          ? "After planning, you will be offered the apply loop (models + gates)."
          : "Plan only — run /openspec-loop when ready to implement.",
      ].join("\n"),
      "info",
    );

    await adapter.prompt(buildProposePrompt({ change, description, hasCli }));
  }

  async function onPlanningEnded(adapter: HarnessAdapter, ctx: ExtensionContext): Promise<void> {
    const change = workflow.change;
    if (!change) {
      workflow.phase = "idle";
      return;
    }

    const readiness = await assessPlanReadiness(adapter, change);
    adapter.notify(formatPlanReadiness(readiness), readiness.ready ? "info" : "warning");

    if (!workflow.continueToApply) {
      workflow.phase = readiness.ready ? "awaiting_apply" : "idle";
      if (readiness.ready) {
        adapter.notify("Plan ready. Run /openspec-loop to implement with the controlled loop.", "info");
      }
      return;
    }

    workflow.phase = "awaiting_apply";
    const start = adapter.confirm
      ? await adapter.confirm(
          "Start APPLY loop now?",
          `${formatPlanReadiness(readiness)}\n\nYou will pick main + gate models next.`,
        )
      : (await adapter.select("Start APPLY loop now?", ["Yes — pick models & apply", "Not yet"]))?.startsWith(
          "Yes",
        );

    if (!start) {
      adapter.notify("OK — run /openspec-loop when you want to apply.", "info");
      return;
    }

    // ExtensionContext is enough for startApplyPhase shutdown check
    await startApplyPhase(adapter, ctx, change);
  }

  pi.on("session_start", (_event, ctx) => {
    const loaded = loadConfig(ctx.cwd);
    config = loaded.config;
    runtime = null;
    workflow = createWorkflowState();
    handlingEnd = false;
    for (const w of loaded.warnings) ctx.ui.notify(w, "warning");
  });

  pi.on("session_shutdown", () => {
    runtime = null;
    resetWorkflow(workflow);
    handlingEnd = false;
  });

  pi.registerCommand("openspec-feature", {
    description: "Full flow: OpenSpec plan → controlled apply loop (models + gates)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const adapter = createPiAdapter(pi, ctx);
      const loaded = loadConfig(ctx.cwd);
      config = loaded.config;
      for (const w of loaded.warnings) adapter.notify(w, "warning");

      const path = await pickFeaturePath(adapter);
      if (!path) return;

      workflow = createWorkflowState();
      workflow.path = path;

      if (path === "apply-only") {
        const change = await pickChange(adapter, config.change, args);
        if (!change) return;
        await startApplyPhase(adapter, ctx, change);
        return;
      }

      const resolved = await resolveNewChangeId(adapter, args);
      if (!resolved) return;

      // Optional: confirm planning model (same gate as apply — avoid wrong LLM)
      if (config.defaults.confirm_main_model !== false && adapter.getCurrentModel) {
        const current = adapter.getCurrentModel();
        const ok = adapter.confirm
          ? await adapter.confirm(
              "Planning model OK?",
              `Current session model: ${current ?? "(none)"}\nUse this model to write the OpenSpec plan?`,
            )
          : true;
        if (!ok) {
          adapter.notify("Switch model with /model, then re-run /openspec-feature.", "warning");
          return;
        }
      }

      await startPlanPhase(adapter, resolved.change, resolved.description, path === "full");
    },
  });

  pi.registerCommand("openspec-plan", {
    description: "OpenSpec planning only (proposal, specs, design, tasks)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const adapter = createPiAdapter(pi, ctx);
      const loaded = loadConfig(ctx.cwd);
      config = loaded.config;

      const resolved = await resolveNewChangeId(adapter, args);
      if (!resolved) return;

      workflow = createWorkflowState();
      workflow.path = "plan-only";
      await startPlanPhase(adapter, resolved.change, resolved.description, false);
    },
  });

  pi.registerCommand("openspec-loop", {
    description: "Apply loop only (templates, confirm models, gates)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const adapter = createPiAdapter(pi, ctx);
      const loaded = loadConfig(ctx.cwd);
      config = loaded.config;
      for (const w of loaded.warnings) adapter.notify(w, "warning");

      const change = await pickChange(adapter, config.change, args);
      if (!change) return;

      workflow = createWorkflowState();
      workflow.path = "apply-only";
      await startApplyPhase(adapter, ctx, change);
    },
  });

  pi.registerCommand("openspec-loop-save", {
    description: "Save the current run setup as a YAML template",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!runtime?.setup) {
        ctx.ui.notify("No active run setup. Start with /openspec-loop first.", "warning");
        return;
      }
      const adapter = createPiAdapter(pi, ctx);
      let name = args.trim() || runtime.setup.name;
      if (!args.trim() && adapter.input) {
        const typed = await adapter.input("Template name", name);
        if (typed?.trim()) name = typed.trim();
      }
      const setup: RunSetup = { ...runtime.setup, name, created_at: new Date().toISOString() };
      const path = saveRunSetup(ctx.cwd, setup);
      saveLastRun(ctx.cwd, setup);
      runtime.setup = setup;
      adapter.notify(`Saved: ${path}`, "info");
    },
  });

  pi.registerCommand("openspec-loop-runs", {
    description: "List saved openspec-loop run templates",
    handler: async (_args, ctx) => {
      const adapter = createPiAdapter(pi, ctx);
      const loaded = loadConfig(ctx.cwd);
      const listed = listRunTemplates(ctx.cwd, loaded.config);
      if (listed.length === 0) {
        adapter.notify("No run templates yet.", "info");
        return;
      }
      adapter.notify(
        listed
          .map(
            (r) =>
              `- ${r.name} [${r.source}] main=${r.setup.main_model} gates=${JSON.stringify(r.setup.gate_models)}`,
          )
          .join("\n"),
        "info",
      );
    },
  });

  pi.registerCommand("openspec-loop-stop", {
    description: "Stop/disarm the apply loop controller",
    handler: async (_args, ctx) => {
      if (workflow.phase === "planning") {
        resetWorkflow(workflow);
        ctx.ui.notify("Planning phase cancelled.", "info");
        return;
      }
      if (!runtime?.active) {
        ctx.ui.notify("openspec-loop is not active.", "info");
        return;
      }
      runtime.active = false;
      workflow.phase = "idle";
      ctx.ui.notify("openspec-loop disarmed.", "info");
    },
  });

  pi.registerCommand("openspec-loop-status", {
    description: "Show workflow phase, models, and task progress",
    handler: async (_args, ctx) => {
      const adapter = createPiAdapter(pi, ctx);
      const lines = [
        `workflow.phase: ${workflow.phase}`,
        `workflow.path: ${workflow.path ?? "-"}`,
        `workflow.change: ${workflow.change ?? "-"}`,
        `session_model: ${adapter.getCurrentModel?.() ?? "?"}`,
      ];

      if (runtime) {
        const state = await loadChangeState(adapter, runtime.change);
        lines.push(
          `apply.active: ${runtime.active}`,
          `apply.mode: ${runtime.mode}`,
          `apply.iteration: ${runtime.iteration}/${config.max_iterations}`,
          `tasks: ${state.complete}/${state.total} done`,
        );
        if (runtime.setup) lines.push("", formatRunSetup(runtime.setup));
      } else if (workflow.change) {
        const readiness = await assessPlanReadiness(adapter, workflow.change);
        lines.push("", formatPlanReadiness(readiness));
      }

      adapter.notify(lines.join("\n"), "info");
    },
  });

  pi.on("agent_end", async (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (handlingEnd) return;
    handlingEnd = true;
    const adapter = createPiAdapter(pi, ctx);

    try {
      if (workflow.phase === "planning") {
        await onPlanningEnded(adapter, ctx);
        return;
      }

      if (!runtime?.active) return;

      if (runtime.mode === "stop-gate") {
        const result = await handleStopGate(adapter, config, runtime);
        if (result === "halted") ctx.shutdown();
        if (!runtime.active) workflow.phase = "idle";
        return;
      }

      if (runtime.mode === "apply-loop") {
        const result = await handleApplyLoopTick(adapter, config, runtime);
        if (result === "halted") ctx.shutdown();
        if (!runtime.active) workflow.phase = "idle";
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`openspec-loop error: ${msg}`, "error");
    } finally {
      handlingEnd = false;
    }
  });
}
