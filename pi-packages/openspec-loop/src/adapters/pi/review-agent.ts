import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export interface ReviewAgentOptions {
  prompt: string;
  model?: string;
  tools?: string[];
  timeoutMs?: number;
  cwd: string;
  signal?: AbortSignal;
}

export interface ReviewAgentResult {
  ok: boolean;
  output: string;
  detail?: string;
  exitCode: number;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

function extractAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; content?: unknown };
    if (msg?.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{ type?: string; text?: string }>) {
      if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return "";
}

/**
 * Spawn an isolated `pi --mode json -p` review agent.
 * Mirrors the official subagent example pattern.
 */
export async function runReviewAgent(opts: ReviewAgentOptions): Promise<ReviewAgentResult> {
  const args: string[] = ["--mode", "json", "-p", "--no-session"];
  if (opts.model) args.push("--model", opts.model);
  const tools = opts.tools?.length ? opts.tools : ["read", "grep", "find", "ls", "bash"];
  args.push("--tools", tools.join(","));

  let tmpDir: string | null = null;
  try {
    tmpDir = mkdtempSync(join(tmpdir(), "openspec-loop-review-"));
    const promptPath = join(tmpDir, "prompt.md");
    const systemPrompt = [
      "You are a strict review gate for an OpenSpec-driven change.",
      "Inspect the repository as needed.",
      "Do not modify files. Prefer read-only git/bash commands.",
      "Your FINAL answer MUST begin with a line that is exactly PASS or FAIL: <reason>.",
    ].join("\n");
    writeFileSync(promptPath, systemPrompt, { encoding: "utf8", mode: 0o600 });
    args.push("--append-system-prompt", promptPath);
    args.push(opts.prompt);

    const messages: unknown[] = [];
    let stderr = "";

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: opts.cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";
      let settled = false;

      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        resolve(code);
      };

      const onAbort = () => {
        try {
          proc.kill("SIGTERM");
        } catch {
          /* ignore */
        }
        finish(130);
      };

      if (opts.signal) {
        if (opts.signal.aborted) onAbort();
        else opts.signal.addEventListener("abort", onAbort, { once: true });
      }

      const timer =
        opts.timeoutMs && opts.timeoutMs > 0
          ? setTimeout(() => {
              try {
                proc.kill("SIGTERM");
              } catch {
                /* ignore */
              }
              finish(124);
            }, opts.timeoutMs)
          : null;

      proc.stdout?.setEncoding("utf8");
      proc.stdout?.on("data", (chunk: string) => {
        buffer += chunk;
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type?: string; message?: unknown };
            if (event.type === "message_end" && event.message) {
              messages.push(event.message);
            }
          } catch {
            /* ignore non-json */
          }
        }
      });

      proc.stderr?.setEncoding("utf8");
      proc.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });

      proc.on("error", (err) => {
        stderr += err.message;
        if (timer) clearTimeout(timer);
        finish(1);
      });

      proc.on("close", (code) => {
        if (timer) clearTimeout(timer);
        finish(code ?? 1);
      });
    });

    const output = extractAssistantText(messages);
    if (exitCode === 124) {
      return { ok: false, output, exitCode, detail: "Review agent timed out." };
    }
    if (exitCode !== 0 && !output) {
      return {
        ok: false,
        output,
        exitCode,
        detail: stderr.trim() || `Review agent exited with code ${exitCode}.`,
      };
    }
    if (!output) {
      return {
        ok: false,
        output: "",
        exitCode,
        detail: "Review agent produced no assistant text.",
      };
    }
    return { ok: true, output, exitCode };
  } finally {
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}
