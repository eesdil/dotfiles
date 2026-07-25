import { formatGateSummary, runGates } from "./gates.js";
import { buildApplyPrompt, loadChangeState } from "./openspec.js";
import { nextPendingTask } from "./tasks.js";
import type {
  GateRunResult,
  HarnessAdapter,
  LoopConfig,
  LoopMode,
  LoopRuntimeState,
  RunSetup,
} from "./types.js";

export function createRuntimeState(
  mode: LoopMode,
  change: string,
  setup: RunSetup | null = null,
): LoopRuntimeState {
  return {
    mode,
    change,
    iteration: 0,
    active: true,
    stopRetries: 0,
    setup,
  };
}

function buildGateFailureFollowUp(gateResult: GateRunResult, mode: LoopMode): string {
  return [
    "openspec-loop blocked stopping: required gates failed.",
    "",
    formatGateSummary(gateResult),
    "",
    gateResult.blockReasons.join("\n\n"),
    "",
    mode === "apply-loop"
      ? "Fix the failures, keep tasks.md accurate, then continue with the current/next task."
      : "Fix the failures before considering the work done. Do not stop until gates pass.",
  ].join("\n");
}

export async function handleStopGate(
  adapter: HarnessAdapter,
  config: LoopConfig,
  runtime: LoopRuntimeState,
): Promise<"allow" | "blocked" | "halted"> {
  if (!runtime.active || runtime.mode !== "stop-gate") return "allow";
  if (config.gates.length === 0) return "allow";

  const maxRetries = config.policy.max_stop_retries ?? 3;
  if (runtime.stopRetries >= maxRetries) {
    adapter.notify(
      `openspec-loop: stop-gate retry limit (${maxRetries}) reached; allowing stop.`,
      "warning",
    );
    runtime.active = false;
    return "allow";
  }

  const gateResult = await runGates(adapter, config.gates);
  if (gateResult.passed) {
    adapter.notify("openspec-loop: gates passed.", "info");
    runtime.active = false;
    runtime.stopRetries = 0;
    return "allow";
  }

  if (config.on_gate_fail === "stop") {
    adapter.notify("openspec-loop: gates failed; stopping session per on_gate_fail=stop.", "error");
    runtime.active = false;
    return "halted";
  }

  if (config.on_gate_fail === "ask") {
    const choice = await adapter.select("Gates failed. What next?", [
      "Keep working (follow-up)",
      "Allow stop anyway",
      "Halt session",
    ]);
    if (choice === "Allow stop anyway") {
      runtime.active = false;
      return "allow";
    }
    if (choice === "Halt session") {
      runtime.active = false;
      return "halted";
    }
  }

  runtime.stopRetries += 1;
  adapter.followUp(buildGateFailureFollowUp(gateResult, "stop-gate"));
  return "blocked";
}

export async function handleApplyLoopTick(
  adapter: HarnessAdapter,
  config: LoopConfig,
  runtime: LoopRuntimeState,
): Promise<"continue" | "done" | "blocked" | "halted" | "idle"> {
  if (!runtime.active || runtime.mode !== "apply-loop") return "idle";

  if (runtime.iteration >= config.max_iterations) {
    adapter.notify(
      `openspec-loop: max_iterations (${config.max_iterations}) reached.`,
      "warning",
    );
    runtime.active = false;
    return "done";
  }

  const state = await loadChangeState(adapter, runtime.change);
  const pending = nextPendingTask(state.tasks);

  // No tasks file or nothing left — run final gates then finish
  if (!pending) {
    if (config.policy.never_mark_done_without_gates !== false && config.gates.length > 0) {
      const gateResult = await runGates(adapter, config.gates);
      if (!gateResult.passed) {
        if (config.on_gate_fail === "stop") {
          runtime.active = false;
          return "halted";
        }
        const maxRetries = config.policy.max_stop_retries ?? 3;
        if (runtime.stopRetries >= maxRetries) {
          adapter.notify("openspec-loop: final gate retry limit reached.", "warning");
          runtime.active = false;
          return "done";
        }
        runtime.stopRetries += 1;
        adapter.followUp(buildGateFailureFollowUp(gateResult, "apply-loop"));
        return "blocked";
      }
    }
    adapter.notify(`openspec-loop: change \`${runtime.change}\` complete.`, "info");
    runtime.active = false;
    return "done";
  }

  // Between tasks: gate after each completed iteration
  if (runtime.iteration > 0 && config.gates.length > 0) {
    const gateResult = await runGates(adapter, config.gates);
    if (!gateResult.passed) {
      if (config.on_gate_fail === "stop") {
        runtime.active = false;
        return "halted";
      }
      if (config.on_gate_fail === "ask") {
        const choice = await adapter.select("Gates failed mid-loop. What next?", [
          "Keep fixing (follow-up)",
          "Skip gates and continue tasks",
          "Stop loop",
        ]);
        if (choice === "Stop loop") {
          runtime.active = false;
          return "done";
        }
        if (choice !== "Skip gates and continue tasks") {
          runtime.stopRetries += 1;
          adapter.followUp(buildGateFailureFollowUp(gateResult, "apply-loop"));
          return "blocked";
        }
      } else {
        const maxRetries = config.policy.max_stop_retries ?? 3;
        if (runtime.stopRetries >= maxRetries) {
          adapter.notify("openspec-loop: mid-loop gate retry limit reached.", "warning");
          runtime.active = false;
          return "done";
        }
        runtime.stopRetries += 1;
        adapter.followUp(buildGateFailureFollowUp(gateResult, "apply-loop"));
        return "blocked";
      }
    } else {
      runtime.stopRetries = 0;
    }
  }

  runtime.iteration += 1;
  const prompt = buildApplyPrompt(state, config.policy.one_task_per_turn !== false);
  adapter.notify(
    `openspec-loop: iteration ${runtime.iteration}/${config.max_iterations} — ${state.complete}/${state.total} tasks done`,
    "info",
  );
  await adapter.prompt(prompt);
  return "continue";
}

export function describeMode(mode: LoopMode): string {
  if (mode === "stop-gate") {
    return "stop-gate: agent works freely; on stop, run gates and block until they pass";
  }
  return "apply-loop: controller walks tasks.md one-by-one, running gates between steps";
}
