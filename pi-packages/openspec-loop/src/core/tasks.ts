import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { TaskItem } from "./types.js";

const TASK_RE = /^(\s*)-\s+\[([ xX])\]\s+(.*)$/;

export function parseTasksMarkdown(content: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  const lines = content.split(/\r?\n/);
  let index = 0;
  for (const line of lines) {
    const m = line.match(TASK_RE);
    if (!m) continue;
    const done = m[2].toLowerCase() === "x";
    tasks.push({
      index,
      text: m[3].trim(),
      done,
      line,
    });
    index += 1;
  }
  return tasks;
}

export function loadTasks(tasksPath: string): TaskItem[] {
  if (!existsSync(tasksPath)) return [];
  return parseTasksMarkdown(readFileSync(tasksPath, "utf8"));
}

export function nextPendingTask(tasks: TaskItem[]): TaskItem | null {
  return tasks.find((t) => !t.done) ?? null;
}

/** Mark the first matching unchecked task as done by exact text. */
export function markTaskDone(tasksPath: string, taskText: string): boolean {
  if (!existsSync(tasksPath)) return false;
  const content = readFileSync(tasksPath, "utf8");
  const lines = content.split(/\r?\n/);
  let changed = false;
  const out = lines.map((line) => {
    if (changed) return line;
    const m = line.match(TASK_RE);
    if (!m) return line;
    const done = m[2].toLowerCase() === "x";
    if (done) return line;
    if (m[3].trim() !== taskText.trim()) return line;
    changed = true;
    return `${m[1]}- [x] ${m[3]}`;
  });
  if (changed) {
    writeFileSync(tasksPath, out.join("\n"), "utf8");
  }
  return changed;
}
