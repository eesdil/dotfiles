/** Loop modes the user can select. */
export type LoopMode = "stop-gate" | "apply-loop";

/** What to do when a required gate fails. */
export type OnGateFail = "continue" | "stop" | "ask";

export type GateType = "shell" | "agent";

export interface ShellGate {
  name: string;
  type: "shell";
  /** Shell command run via bash -c */
  command: string;
  required?: boolean;
  /** Timeout in seconds */
  timeout?: number;
}

export interface AgentGate {
  name: string;
  type: "agent";
  /**
   * Review prompt. The reviewer must start its final answer with:
   *   PASS
   * or
   *   FAIL: <reason>
   */
  prompt: string;
  /** Optional model override for the review subprocess (`provider/id`) */
  model?: string;
  /** Comma-friendly tool list, default: read,grep,find,ls,bash */
  tools?: string[];
  required?: boolean;
  timeout?: number;
}

export type Gate = ShellGate | AgentGate;

export interface LoopPolicy {
  never_mark_done_without_gates?: boolean;
  one_task_per_turn?: boolean;
  /** Max times stop-gate may re-kick after a failure (prevents infinite loops) */
  max_stop_retries?: number;
}

export interface LoopDefaults {
  /** Default main model `provider/id` for fresh setups */
  main_model?: string;
  /** Always confirm main model before starting (default true) */
  confirm_main_model?: boolean;
  /** Offer to save the run as a template after setup (default true) */
  ask_save_template?: boolean;
}

/**
 * A concrete run setup — main model + per-gate models.
 * Saved as YAML under `.pi/openspec-loop/runs/` for LLM bakeoffs / reuse.
 */
export interface RunSetup {
  name: string;
  created_at?: string;
  mode: LoopMode;
  change?: string;
  /** Main coding agent model: `provider/id` */
  main_model: string;
  /** Optional thinking level applied to the main session */
  thinking_level?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  /** Agent-gate name → `provider/id` */
  gate_models: Record<string, string>;
  notes?: string;
}

export interface LoopConfig {
  /**
   * Default mode. Use "ask" to prompt at /openspec-loop start.
   */
  mode: LoopMode | "ask";
  /** OpenSpec change name, or "auto" to resolve */
  change: string;
  max_iterations: number;
  on_gate_fail: OnGateFail;
  gates: Gate[];
  policy: LoopPolicy;
  defaults: LoopDefaults;
  /** Inline named run templates (also discoverable from runs/*.yaml) */
  templates: Record<string, Partial<RunSetup>>;
}

export interface TaskItem {
  index: number;
  text: string;
  done: boolean;
  /** Original markdown line */
  line: string;
}

export interface ChangeState {
  change: string;
  tasksPath: string | null;
  tasks: TaskItem[];
  remaining: number;
  complete: number;
  total: number;
}

export type GateVerdict =
  | { name: string; ok: true; detail?: string }
  | { name: string; ok: false; detail: string; required: boolean };

export interface GateRunResult {
  passed: boolean;
  results: GateVerdict[];
  /** Human-readable block reasons for required failures */
  blockReasons: string[];
}

export interface LoopRuntimeState {
  mode: LoopMode;
  change: string;
  iteration: number;
  active: boolean;
  stopRetries: number;
  /** Active run setup (models) for this session */
  setup: RunSetup | null;
}

export interface HarnessExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ModelSetResult {
  ok: boolean;
  error?: string;
}

/**
 * Harness adapter surface. Pi implements this now; Cursor/Claude later.
 */
export interface HarnessAdapter {
  cwd: string;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string | undefined): void;
  select(title: string, options: string[]): Promise<string | undefined>;
  confirm?(title: string, message: string): Promise<boolean>;
  input?(title: string, placeholder?: string): Promise<string | undefined>;
  exec(command: string, args: string[], opts?: { timeoutMs?: number; cwd?: string }): Promise<HarnessExecResult>;
  /** Run a one-shot shell via bash -c */
  shell(command: string, opts?: { timeoutMs?: number; cwd?: string }): Promise<HarnessExecResult>;
  /** Inject a follow-up that continues the agent */
  followUp(content: string): void;
  /** Kick the main agent with a user prompt */
  prompt(content: string): void | Promise<void>;
  /** Available models as `provider/id` */
  listModels?(): string[];
  /** Current session model as `provider/id`, or null */
  getCurrentModel?(): string | null;
  /** Switch the main session model */
  setMainModel?(ref: string): Promise<ModelSetResult>;
  /**
   * Run a review agent (isolated). Returns final assistant text.
   * Optional — if missing, agent gates fail closed with a clear message.
   */
  runReviewAgent?(opts: {
    prompt: string;
    model?: string;
    tools?: string[];
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<{ ok: boolean; output: string; detail?: string }>;
}
