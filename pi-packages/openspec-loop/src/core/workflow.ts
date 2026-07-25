import type { LoopMode, RunSetup } from "./types.js";

export type WorkflowPhase =
  | "idle"
  | "planning"
  | "awaiting_apply"
  | "applying";

export type FeaturePath = "full" | "plan-only" | "apply-only";

export interface WorkflowState {
  phase: WorkflowPhase;
  path: FeaturePath | null;
  change: string | null;
  description: string | null;
  /** After planning, automatically offer the apply-loop wizard */
  continueToApply: boolean;
  setup: RunSetup | null;
  mode: LoopMode | null;
}

export function createWorkflowState(): WorkflowState {
  return {
    phase: "idle",
    path: null,
    change: null,
    description: null,
    continueToApply: false,
    setup: null,
    mode: null,
  };
}

export function resetWorkflow(state: WorkflowState): void {
  Object.assign(state, createWorkflowState());
}
