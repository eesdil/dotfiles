import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  AgentGate,
  Gate,
  LoopConfig,
  LoopDefaults,
  LoopMode,
  OnGateFail,
  RunSetup,
  ShellGate,
} from "./types.js";

const DEFAULT_CONFIG: LoopConfig = {
  mode: "ask",
  change: "auto",
  max_iterations: 40,
  on_gate_fail: "continue",
  gates: [
    {
      name: "unit-tests",
      type: "shell",
      command: "npm test",
      required: true,
      timeout: 600,
    },
  ],
  policy: {
    never_mark_done_without_gates: true,
    one_task_per_turn: true,
    max_stop_retries: 3,
  },
  defaults: {
    confirm_main_model: true,
    ask_save_template: true,
  },
  templates: {},
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function parseMode(v: unknown): LoopMode | "ask" {
  if (v === "stop-gate" || v === "apply-loop" || v === "ask") return v;
  return DEFAULT_CONFIG.mode;
}

function parseOnGateFail(v: unknown): OnGateFail {
  if (v === "continue" || v === "stop" || v === "ask") return v;
  return DEFAULT_CONFIG.on_gate_fail;
}

function parseGate(raw: unknown, index: number): Gate | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name, `gate-${index + 1}`);
  const type = raw.type === "agent" ? "agent" : raw.type === "shell" ? "shell" : null;
  if (!type) return null;

  if (type === "shell") {
    const command = asString(raw.command, "");
    if (!command) return null;
    const gate: ShellGate = {
      name,
      type: "shell",
      command,
      required: asBool(raw.required, true),
      timeout: asNumber(raw.timeout, 600),
    };
    return gate;
  }

  const prompt = asString(raw.prompt, "");
  if (!prompt) return null;
  const gate: AgentGate = {
    name,
    type: "agent",
    prompt,
    model: typeof raw.model === "string" ? raw.model : undefined,
    tools: Array.isArray(raw.tools)
      ? raw.tools.filter((t): t is string => typeof t === "string")
      : typeof raw.tools === "string"
        ? raw.tools.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    required: asBool(raw.required, true),
    timeout: asNumber(raw.timeout, 600),
  };
  return gate;
}

function parseDefaults(raw: unknown): LoopDefaults {
  const base = { ...DEFAULT_CONFIG.defaults };
  if (!isRecord(raw)) return base;
  return {
    main_model: typeof raw.main_model === "string" ? raw.main_model : base.main_model,
    confirm_main_model: asBool(raw.confirm_main_model, base.confirm_main_model ?? true),
    ask_save_template: asBool(raw.ask_save_template, base.ask_save_template ?? true),
  };
}

function parseTemplates(raw: unknown): Record<string, Partial<RunSetup>> {
  if (!isRecord(raw)) return {};
  const out: Record<string, Partial<RunSetup>> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const gate_models: Record<string, string> = {};
    if (isRecord(value.gate_models)) {
      for (const [gk, gv] of Object.entries(value.gate_models)) {
        if (typeof gv === "string" && gv.trim()) gate_models[gk] = gv.trim();
      }
    }
    out[name] = {
      name,
      mode: value.mode === "apply-loop" || value.mode === "stop-gate" ? value.mode : undefined,
      main_model: typeof value.main_model === "string" ? value.main_model : undefined,
      change: typeof value.change === "string" ? value.change : undefined,
      notes: typeof value.notes === "string" ? value.notes : undefined,
      gate_models,
      thinking_level:
        value.thinking_level === "off" ||
        value.thinking_level === "minimal" ||
        value.thinking_level === "low" ||
        value.thinking_level === "medium" ||
        value.thinking_level === "high" ||
        value.thinking_level === "xhigh"
          ? value.thinking_level
          : undefined,
    };
  }
  return out;
}

function mergeConfig(partial: unknown): LoopConfig {
  if (!isRecord(partial)) return structuredClone(DEFAULT_CONFIG);

  const gatesRaw = Array.isArray(partial.gates) ? partial.gates : null;
  const gates = gatesRaw
    ? gatesRaw.map(parseGate).filter((g): g is Gate => g !== null)
    : structuredClone(DEFAULT_CONFIG.gates);

  const policyRaw = isRecord(partial.policy) ? partial.policy : {};
  const defaults = DEFAULT_CONFIG.policy;

  // Support both top-level defaults: and nested under defaults key;
  // also allow legacy top-level main_model confirm flags.
  const defaultsRaw = isRecord(partial.defaults) ? partial.defaults : {};
  const mergedDefaults = parseDefaults({
    ...defaultsRaw,
    main_model: defaultsRaw.main_model ?? partial.main_model,
    confirm_main_model: defaultsRaw.confirm_main_model ?? partial.confirm_main_model,
    ask_save_template: defaultsRaw.ask_save_template ?? partial.ask_save_template,
  });

  return {
    mode: parseMode(partial.mode),
    change: asString(partial.change, DEFAULT_CONFIG.change),
    max_iterations: asNumber(partial.max_iterations, DEFAULT_CONFIG.max_iterations),
    on_gate_fail: parseOnGateFail(partial.on_gate_fail),
    gates: gates.length > 0 ? gates : structuredClone(DEFAULT_CONFIG.gates),
    policy: {
      never_mark_done_without_gates: asBool(
        policyRaw.never_mark_done_without_gates,
        defaults.never_mark_done_without_gates ?? true,
      ),
      one_task_per_turn: asBool(policyRaw.one_task_per_turn, defaults.one_task_per_turn ?? true),
      max_stop_retries: asNumber(policyRaw.max_stop_retries, defaults.max_stop_retries ?? 3),
    },
    defaults: mergedDefaults,
    templates: parseTemplates(partial.templates),
  };
}

const CONFIG_CANDIDATES = [
  ".pi/openspec-loop.yaml",
  ".pi/openspec-loop.yml",
  ".pi/openspec-loop.json",
  "openspec/loop.yaml",
  "openspec/loop.yml",
  "openspec/loop.json",
];

export function configPaths(cwd: string): string[] {
  return CONFIG_CANDIDATES.map((p) => join(cwd, p));
}

export function findConfigPath(cwd: string): string | null {
  for (const p of configPaths(cwd)) {
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadConfig(cwd: string): { config: LoopConfig; path: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const path = findConfigPath(cwd);
  if (!path) {
    return { config: structuredClone(DEFAULT_CONFIG), path: null, warnings };
  }

  try {
    const text = readFileSync(path, "utf8");
    const raw = path.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
    return { config: mergeConfig(raw), path, warnings };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to parse ${path}: ${msg}. Using defaults.`);
    return { config: structuredClone(DEFAULT_CONFIG), path, warnings };
  }
}

export function defaultConfig(): LoopConfig {
  return structuredClone(DEFAULT_CONFIG);
}
