import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { LoopConfig, LoopMode, RunSetup } from "./types.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function parseGateModels(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function parseMode(v: unknown): LoopMode | null {
  return v === "stop-gate" || v === "apply-loop" ? v : null;
}

export function parseRunSetup(raw: unknown, fallbackName = "unnamed"): RunSetup | null {
  if (!isRecord(raw)) return null;
  const main_model = asString(raw.main_model).trim();
  if (!main_model) return null;
  const mode = parseMode(raw.mode) ?? "stop-gate";
  const thinking = asString(raw.thinking_level).trim();
  const thinking_level =
    thinking === "off" ||
    thinking === "minimal" ||
    thinking === "low" ||
    thinking === "medium" ||
    thinking === "high" ||
    thinking === "xhigh"
      ? thinking
      : undefined;

  return {
    name: asString(raw.name, fallbackName).trim() || fallbackName,
    created_at: asString(raw.created_at) || undefined,
    mode,
    change: asString(raw.change) || undefined,
    main_model,
    thinking_level,
    gate_models: parseGateModels(raw.gate_models),
    notes: asString(raw.notes) || undefined,
  };
}

export function projectRunsDir(cwd: string): string {
  return join(cwd, ".pi", "openspec-loop", "runs");
}

export function lastRunPath(cwd: string): string {
  return join(projectRunsDir(cwd), "last.yaml");
}

function ensureRunsDir(cwd: string): string {
  const dir = projectRunsDir(cwd);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function slugifyRunName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "run"
  );
}

export function formatRunSetup(setup: RunSetup): string {
  const gateLines = Object.entries(setup.gate_models).map(([k, v]) => `  - ${k}: ${v}`);
  return [
    `name: ${setup.name}`,
    `mode: ${setup.mode}`,
    setup.change ? `change: ${setup.change}` : null,
    `main_model: ${setup.main_model}`,
    setup.thinking_level ? `thinking: ${setup.thinking_level}` : null,
    gateLines.length ? `gate_models:\n${gateLines.join("\n")}` : "gate_models: (none)",
    setup.notes ? `notes: ${setup.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function runSetupToYaml(setup: RunSetup): string {
  const doc: Record<string, unknown> = {
    name: setup.name,
    created_at: setup.created_at ?? new Date().toISOString(),
    mode: setup.mode,
    main_model: setup.main_model,
    gate_models: setup.gate_models,
  };
  if (setup.change) doc.change = setup.change;
  if (setup.thinking_level) doc.thinking_level = setup.thinking_level;
  if (setup.notes) doc.notes = setup.notes;
  return stringifyYaml(doc);
}

export function saveRunSetup(cwd: string, setup: RunSetup, filename?: string): string {
  const dir = ensureRunsDir(cwd);
  const base = filename ?? `${slugifyRunName(setup.name)}.yaml`;
  const path = join(dir, base.endsWith(".yaml") || base.endsWith(".yml") ? base : `${base}.yaml`);
  const toSave: RunSetup = {
    ...setup,
    created_at: setup.created_at ?? new Date().toISOString(),
  };
  writeFileSync(path, runSetupToYaml(toSave), "utf8");
  return path;
}

export function saveLastRun(cwd: string, setup: RunSetup): string {
  return saveRunSetup(cwd, { ...setup, name: setup.name || "last" }, "last.yaml");
}

export function loadRunFile(path: string): RunSetup | null {
  if (!existsSync(path)) return null;
  try {
    const raw = parseYaml(readFileSync(path, "utf8"));
    return parseRunSetup(raw, basename(path).replace(/\.ya?ml$/i, ""));
  } catch {
    return null;
  }
}

export function loadLastRun(cwd: string): RunSetup | null {
  return loadRunFile(lastRunPath(cwd));
}

export interface ListedRun {
  name: string;
  path: string;
  setup: RunSetup;
  source: "file" | "config";
}

/** Merge inline config templates + filesystem runs (files win on name clash for listing both). */
export function listRunTemplates(cwd: string, config: LoopConfig): ListedRun[] {
  const byName = new Map<string, ListedRun>();

  for (const [name, partial] of Object.entries(config.templates)) {
    const merged = parseRunSetup({ name, mode: config.mode === "ask" ? "stop-gate" : config.mode, ...partial }, name);
    if (!merged) continue;
    byName.set(name, {
      name,
      path: `(config template: ${name})`,
      setup: merged,
      source: "config",
    });
  }

  const dir = projectRunsDir(cwd);
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!/\.ya?ml$/i.test(file)) continue;
      if (file === "last.yaml" || file === "last.yml") continue;
      const path = join(dir, file);
      const setup = loadRunFile(path);
      if (!setup) continue;
      byName.set(setup.name, {
        name: setup.name,
        path,
        setup,
        source: "file",
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Apply run setup models onto a config clone (agent gate model overrides). */
export function applyRunSetupToConfig(config: LoopConfig, setup: RunSetup): LoopConfig {
  return {
    ...config,
    mode: setup.mode,
    change: setup.change ?? config.change,
    gates: config.gates.map((gate) => {
      if (gate.type !== "agent") return { ...gate };
      const model = setup.gate_models[gate.name] ?? gate.model;
      return { ...gate, model };
    }),
  };
}

export function parseModelRef(ref: string): { provider: string; id: string } | null {
  const trimmed = ref.trim();
  const idx = trimmed.indexOf("/");
  if (idx <= 0 || idx === trimmed.length - 1) return null;
  return { provider: trimmed.slice(0, idx), id: trimmed.slice(idx + 1) };
}

export function formatModelRef(provider: string, id: string): string {
  return `${provider}/${id}`;
}
