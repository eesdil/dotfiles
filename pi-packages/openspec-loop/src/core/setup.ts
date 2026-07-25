import {
  applyRunSetupToConfig,
  formatRunSetup,
  listRunTemplates,
  loadLastRun,
  saveLastRun,
  saveRunSetup,
  type ListedRun,
} from "./runs.js";
import type { AgentGate, HarnessAdapter, LoopConfig, LoopMode, RunSetup } from "./types.js";

function agentGates(config: LoopConfig): AgentGate[] {
  return config.gates.filter((g): g is AgentGate => g.type === "agent");
}

async function pickMode(
  adapter: HarnessAdapter,
  configured: LoopConfig["mode"],
  preset?: LoopMode,
): Promise<LoopMode | null> {
  if (preset) return preset;
  if (configured === "stop-gate" || configured === "apply-loop") return configured;

  const choice = await adapter.select("openspec-loop mode", [
    "stop-gate — gates run when the agent tries to stop",
    "apply-loop — controller walks OpenSpec tasks.md",
  ]);
  if (!choice) return null;
  return choice.startsWith("apply-loop") ? "apply-loop" : "stop-gate";
}

async function pickModel(
  adapter: HarnessAdapter,
  title: string,
  preferred?: string | null,
): Promise<string | null> {
  const models = adapter.listModels?.() ?? [];
  const current = adapter.getCurrentModel?.() ?? null;
  const options: string[] = [];

  if (preferred) options.push(`Use: ${preferred}`);
  if (current && current !== preferred) options.push(`Current session: ${current}`);
  for (const m of models) {
    if (m !== preferred && m !== current) options.push(m);
  }

  if (options.length === 0) {
    if (preferred) return preferred;
    if (current) return current;
    adapter.notify("No models available to select.", "error");
    return null;
  }

  const choice = await adapter.select(title, options);
  if (!choice) return null;
  if (choice.startsWith("Use: ")) return choice.slice("Use: ".length);
  if (choice.startsWith("Current session: ")) return choice.slice("Current session: ".length);
  return choice;
}

/**
 * Main-model confirmation gate — prevents starting with the wrong LLM.
 */
async function confirmOrPickMainModel(
  adapter: HarnessAdapter,
  config: LoopConfig,
  initial?: string | null,
): Promise<string | null> {
  const current = adapter.getCurrentModel?.() ?? null;
  let candidate = initial || config.defaults.main_model || current;

  if (!candidate) {
    candidate = await pickModel(adapter, "Select MAIN coding model for this task");
    if (!candidate) return null;
  }

  const mustConfirm = config.defaults.confirm_main_model !== false;

  while (true) {
    if (!mustConfirm) {
      const picked = await pickModel(adapter, "Select MAIN coding model", candidate);
      return picked;
    }

    const message = [
      `Main model for this task: ${candidate}`,
      current && current !== candidate ? `Session is currently: ${current}` : null,
      "",
      "Is this the correct agent/model for this OpenSpec change?",
    ]
      .filter((l) => l !== null)
      .join("\n");

    if (adapter.confirm) {
      const ok = await adapter.confirm("Confirm MAIN model", message);
      if (ok) return candidate;
    } else {
      const choice = await adapter.select("Confirm MAIN model", [
        `Yes — use ${candidate}`,
        "No — choose a different model",
        "Cancel",
      ]);
      if (!choice || choice === "Cancel") return null;
      if (choice.startsWith("Yes")) return candidate;
    }

    const next = await pickModel(adapter, "Select MAIN coding model", candidate);
    if (!next) return null;
    candidate = next;
  }
}

async function pickGateModels(
  adapter: HarnessAdapter,
  config: LoopConfig,
  mainModel: string,
  preset: Record<string, string>,
): Promise<Record<string, string> | null> {
  const gates = agentGates(config);
  const gate_models: Record<string, string> = {};

  for (const gate of gates) {
    const preferred = preset[gate.name] ?? gate.model ?? mainModel;
    const choice = await adapter.select(`Model for agent gate "${gate.name}"`, [
      `Use: ${preferred}`,
      `Same as main: ${mainModel}`,
      "Choose different model…",
      "Skip this gate model (use config default)",
    ]);
    if (!choice) return null;

    if (choice.startsWith("Use: ")) {
      gate_models[gate.name] = choice.slice("Use: ".length);
    } else if (choice.startsWith("Same as main:")) {
      gate_models[gate.name] = mainModel;
    } else if (choice.startsWith("Skip")) {
      if (gate.model) gate_models[gate.name] = gate.model;
    } else {
      const picked = await pickModel(
        adapter,
        `Select model for gate "${gate.name}"`,
        preferred,
      );
      if (!picked) return null;
      gate_models[gate.name] = picked;
    }
  }

  return gate_models;
}

async function maybeSaveTemplate(
  adapter: HarnessAdapter,
  cwd: string,
  setup: RunSetup,
  config: LoopConfig,
): Promise<string | null> {
  if (config.defaults.ask_save_template === false) {
    return saveLastRun(cwd, setup);
  }

  const choice = await adapter.select("Save this run setup?", [
    "Save as named template (YAML)",
    "Save as last only",
    "Don't save",
  ]);
  if (!choice || choice === "Don't save") {
    return saveLastRun(cwd, setup);
  }

  saveLastRun(cwd, setup);

  if (choice.startsWith("Save as last")) {
    return lastSavedLabel(cwd);
  }

  let name = setup.name;
  if (adapter.input) {
    const typed = await adapter.input("Template name", setup.name);
    if (typed?.trim()) name = typed.trim();
  } else {
    const typed = await adapter.select("Template name", [
      setup.name,
      `${setup.main_model.replace(/\//g, "-")}-run`,
      "Cancel",
    ]);
    if (!typed || typed === "Cancel") return lastSavedLabel(cwd);
    name = typed;
  }

  const path = saveRunSetup(cwd, { ...setup, name });
  adapter.notify(`Saved run template: ${path}`, "info");
  return path;
}

function lastSavedLabel(cwd: string): string {
  return `${projectRunsHint(cwd)}/last.yaml`;
}

function projectRunsHint(cwd: string): string {
  return `${cwd}/.pi/openspec-loop/runs`;
}

async function chooseStarter(
  adapter: HarnessAdapter,
  listed: ListedRun[],
  last: RunSetup | null,
): Promise<"fresh" | ListedRun | "last" | null> {
  const options = ["Fresh setup (pick models)"];
  if (last) options.push(`Replay last run (${last.name}: ${last.main_model})`);
  for (const item of listed) {
    const src = item.source === "config" ? "config" : "file";
    options.push(`Template: ${item.name} [${src}] — main ${item.setup.main_model}`);
  }

  const choice = await adapter.select("Run setup source", options);
  if (!choice) return null;
  if (choice.startsWith("Fresh")) return "fresh";
  if (choice.startsWith("Replay last")) return "last";

  const name = choice.replace(/^Template: /, "").split(" [")[0];
  return listed.find((l) => l.name === name) ?? null;
}

export interface PreparedRun {
  setup: RunSetup;
  config: LoopConfig;
  savedPath: string | null;
}

/**
 * Interactive run setup: templates, main-model confirmation, per-gate models, save YAML.
 */
export async function prepareRunSetup(
  adapter: HarnessAdapter,
  config: LoopConfig,
  opts: {
    mode?: LoopMode;
    change: string;
  },
): Promise<PreparedRun | null> {
  const listed = listRunTemplates(adapter.cwd, config);
  const last = loadLastRun(adapter.cwd);
  const starter = await chooseStarter(adapter, listed, last);
  if (!starter) return null;

  let base: Partial<RunSetup> = {};
  if (starter === "last" && last) {
    base = last;
  } else if (starter !== "fresh" && starter !== "last") {
    base = starter.setup;
  }

  const mode = await pickMode(adapter, config.mode, opts.mode ?? (base.mode as LoopMode | undefined));
  if (!mode) return null;

  const main_model = await confirmOrPickMainModel(adapter, config, base.main_model);
  if (!main_model) {
    adapter.notify("openspec-loop cancelled: main model not confirmed.", "warning");
    return null;
  }

  if (adapter.setMainModel) {
    const set = await adapter.setMainModel(main_model);
    if (!set.ok) {
      adapter.notify(`Failed to set main model ${main_model}: ${set.error ?? "unknown"}`, "error");
      return null;
    }
  }

  const gate_models = await pickGateModels(adapter, config, main_model, base.gate_models ?? {});
  if (!gate_models) {
    adapter.notify("openspec-loop cancelled during gate model selection.", "warning");
    return null;
  }

  const defaultName =
    base.name && base.name !== "last"
      ? base.name
      : `${mode}-${main_model.replace(/\//g, "-")}`;

  let setup: RunSetup = {
    name: defaultName,
    created_at: new Date().toISOString(),
    mode,
    change: opts.change,
    main_model,
    thinking_level: base.thinking_level,
    gate_models,
    notes: base.notes,
  };

  const summary = formatRunSetup(setup);
  const proceed = adapter.confirm
    ? await adapter.confirm("Start openspec-loop with this setup?", summary)
    : (await adapter.select("Start with this setup?", [
        "Yes — start",
        "No — cancel",
      ]))?.startsWith("Yes");

  if (!proceed) {
    adapter.notify("openspec-loop cancelled.", "warning");
    return null;
  }

  const savedPath = await maybeSaveTemplate(adapter, adapter.cwd, setup, config);
  // Refresh last always
  saveLastRun(adapter.cwd, setup);

  const applied = applyRunSetupToConfig(config, setup);
  return { setup, config: applied, savedPath };
}
