import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadTasks } from "./tasks.js";
import type { ChangeState, HarnessAdapter } from "./types.js";

interface OpenspecListItem {
  name?: string;
  id?: string;
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function tryOpenspec(adapter: HarnessAdapter, args: string[]): Promise<unknown | null> {
  const result = await adapter.exec("openspec", args, { timeoutMs: 30_000 });
  if (result.code !== 0) return null;
  return parseJsonSafe(result.stdout);
}

function listChangesFromFs(cwd: string): string[] {
  const dir = join(cwd, "openspec", "changes");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "archive")
    .map((d) => d.name)
    .sort();
}

export async function resolveChangeName(
  adapter: HarnessAdapter,
  configured: string,
): Promise<{ change: string | null; candidates: string[]; error?: string }> {
  if (configured && configured !== "auto") {
    return { change: configured, candidates: [configured] };
  }

  const json = await tryOpenspec(adapter, ["list", "--json"]);
  let candidates: string[] = [];

  if (json && typeof json === "object") {
    const items = Array.isArray(json)
      ? json
      : Array.isArray((json as { changes?: unknown }).changes)
        ? ((json as { changes: OpenspecListItem[] }).changes)
        : [];
    candidates = items
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return (item as OpenspecListItem).name || (item as OpenspecListItem).id || "";
        }
        return "";
      })
      .filter(Boolean);
  }

  if (candidates.length === 0) {
    candidates = listChangesFromFs(adapter.cwd);
  }

  if (candidates.length === 0) {
    return { change: null, candidates, error: "No active OpenSpec changes found." };
  }
  if (candidates.length === 1) {
    return { change: candidates[0], candidates };
  }
  return { change: null, candidates };
}

export function findTasksPath(cwd: string, change: string): string | null {
  const candidates = [
    join(cwd, "openspec", "changes", change, "tasks.md"),
    join(cwd, "openspec", "changes", change, "Tasks.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function loadChangeState(adapter: HarnessAdapter, change: string): Promise<ChangeState> {
  const tasksPath = findTasksPath(adapter.cwd, change);
  const tasks = tasksPath ? loadTasks(tasksPath) : [];
  const complete = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return {
    change,
    tasksPath,
    tasks,
    remaining: total - complete,
    complete,
    total,
  };
}

export function buildApplyPrompt(state: ChangeState, oneTaskPerTurn: boolean): string {
  const next = state.tasks.find((t) => !t.done);
  const tasksHint = state.tasksPath
    ? `Track progress in \`${state.tasksPath}\` (check boxes as you finish).`
    : "No tasks.md found; use OpenSpec change artifacts.";

  if (!next) {
    return [
      `OpenSpec change \`${state.change}\` has no remaining unchecked tasks.`,
      tasksHint,
      "If work remains outside the checklist, say so. Otherwise summarize and stop.",
    ].join("\n");
  }

  if (oneTaskPerTurn) {
    return [
      `You are implementing OpenSpec change \`${state.change}\`.`,
      tasksHint,
      "",
      "Implement ONLY this next unchecked task, then stop:",
      `- [ ] ${next.text}`,
      "",
      "Keep the change minimal and scoped to this task.",
      "When done, mark the checkbox `[x]` in tasks.md.",
      "Do not start other tasks in this turn.",
    ].join("\n");
  }

  return [
    `You are implementing OpenSpec change \`${state.change}\`.`,
    tasksHint,
    "",
    `Progress: ${state.complete}/${state.total} complete, ${state.remaining} remaining.`,
    "Work through remaining unchecked tasks. Mark each `[x]` when finished.",
    "Prefer small, verifiable steps.",
  ].join("\n");
}
