import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findTasksPath, loadChangeState } from "./openspec.js";
import { loadTasks } from "./tasks.js";
import type { HarnessAdapter } from "./types.js";

export function slugifyChangeName(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || `change-${Date.now().toString(36)}`;
}

export async function openspecCliAvailable(adapter: HarnessAdapter): Promise<boolean> {
  const result = await adapter.exec("openspec", ["--version"], { timeoutMs: 10_000 });
  return result.code === 0;
}

export function openspecRootExists(cwd: string): boolean {
  return existsSync(join(cwd, "openspec"));
}

/**
 * Ensure openspec/ exists. Prefer CLI init; fall back to a minimal scaffold.
 */
export async function ensureOpenspecProject(
  adapter: HarnessAdapter,
): Promise<{ ok: boolean; detail: string }> {
  if (openspecRootExists(adapter.cwd)) {
    return { ok: true, detail: "openspec/ already present" };
  }

  if (await openspecCliAvailable(adapter)) {
    const init = await adapter.exec(
      "openspec",
      ["init", "--tools", "pi", "--force"],
      { timeoutMs: 120_000 },
    );
    if (init.code === 0 || openspecRootExists(adapter.cwd)) {
      return { ok: true, detail: "openspec init --tools pi completed" };
    }
    return {
      ok: false,
      detail: `openspec init failed:\n${init.stderr || init.stdout}`,
    };
  }

  // Minimal scaffold so planning can proceed without the CLI
  const root = join(adapter.cwd, "openspec");
  mkdirSync(join(root, "changes"), { recursive: true });
  mkdirSync(join(root, "specs"), { recursive: true });
  if (!existsSync(join(root, "config.yaml"))) {
    writeFileSync(
      join(root, "config.yaml"),
      ["schema: spec-driven", "context: |", "  Managed by openspec-loop package.", ""].join("\n"),
      "utf8",
    );
  }
  return {
    ok: true,
    detail:
      "Created minimal openspec/ scaffold (CLI not found). Install @fission-ai/openspec for full tooling.",
  };
}

export interface PlanReadiness {
  ready: boolean;
  change: string;
  hasProposal: boolean;
  hasDesign: boolean;
  hasTasks: boolean;
  hasSpecs: boolean;
  taskCount: number;
  missing: string[];
}

export async function assessPlanReadiness(
  adapter: HarnessAdapter,
  change: string,
): Promise<PlanReadiness> {
  const base = join(adapter.cwd, "openspec", "changes", change);
  const hasProposal = existsSync(join(base, "proposal.md"));
  const hasDesign = existsSync(join(base, "design.md"));
  const tasksPath = findTasksPath(adapter.cwd, change);
  const hasTasks = Boolean(tasksPath);
  const specsDir = join(base, "specs");
  const hasSpecs = existsSync(specsDir);
  const taskCount = tasksPath ? loadTasks(tasksPath).length : 0;

  const missing: string[] = [];
  if (!hasProposal) missing.push("proposal.md");
  if (!hasDesign) missing.push("design.md");
  if (!hasTasks) missing.push("tasks.md");
  if (!hasSpecs) missing.push("specs/");
  if (hasTasks && taskCount === 0) missing.push("tasks.md (no checklist items)");

  return {
    ready: missing.length === 0 && taskCount > 0,
    change,
    hasProposal,
    hasDesign,
    hasTasks,
    hasSpecs,
    taskCount,
    missing,
  };
}

export function formatPlanReadiness(r: PlanReadiness): string {
  const checks = [
    `${r.hasProposal ? "✓" : "✗"} proposal.md`,
    `${r.hasDesign ? "✓" : "✗"} design.md`,
    `${r.hasTasks ? "✓" : "✗"} tasks.md (${r.taskCount} items)`,
    `${r.hasSpecs ? "✓" : "✗"} specs/`,
  ];
  return [
    `Change: ${r.change}`,
    ...checks,
    r.ready ? "Status: READY for apply loop" : `Status: NOT READY — missing: ${r.missing.join(", ")}`,
  ].join("\n");
}

export function buildProposePrompt(opts: {
  change: string;
  description: string;
  hasCli: boolean;
}): string {
  const { change, description, hasCli } = opts;
  return [
    "You are in the OpenSpec PLANNING phase (openspec-loop package).",
    "Do NOT implement application code yet. Only create/update planning artifacts.",
    "",
    `Change id: \`${change}\``,
    `Request: ${description}`,
    "",
    "Goal: produce a complete OpenSpec change ready for the controlled apply loop.",
    "",
    "Create or update these artifacts under `openspec/changes/" + change + "/`:",
    "1. `proposal.md` — why / what / impact",
    "2. `specs/**/*.md` — requirements with Given/When/Then scenarios",
    "3. `design.md` — technical approach and decisions",
    "4. `tasks.md` — implementation checklist with `- [ ]` items (atomic, ordered)",
    "",
    hasCli
      ? [
          "OpenSpec CLI is available. Prefer it when helpful:",
          "- `openspec list --json`",
          "- `openspec status --change \"" + change + "\" --json`",
          "- `openspec instructions propose --change \"" + change + "\" --json` (if supported)",
          "If a change folder does not exist, create the structure above.",
        ].join("\n")
      : "OpenSpec CLI is not installed; create the file structure directly.",
    "",
    "Rules:",
    "- Keep tasks small enough for an agent to finish one per turn",
    "- Include verification tasks (tests/lint) near the end of tasks.md",
    "- Respect `openspec/config.yaml` context/rules when present",
    "- Do not start coding the feature yet",
    "",
    "When artifacts are complete, summarize what you created and stop.",
    "Say clearly: `PLAN READY for /openspec-loop` (or await the feature orchestrator).",
  ].join("\n");
}

export async function summarizeChangeForPlan(
  adapter: HarnessAdapter,
  change: string,
): Promise<string> {
  const state = await loadChangeState(adapter, change);
  const readiness = await assessPlanReadiness(adapter, change);
  return [formatPlanReadiness(readiness), `Progress checkboxes: ${state.complete}/${state.total}`].join(
    "\n",
  );
}
