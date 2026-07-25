import type {
  AgentGate,
  Gate,
  GateRunResult,
  GateVerdict,
  HarnessAdapter,
  ShellGate,
} from "./types.js";

function parseAgentVerdict(output: string): { ok: boolean; detail: string } {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Prefer an explicit PASS/FAIL line anywhere near the end
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if (upper === "PASS" || upper.startsWith("PASS ")) {
      return { ok: true, detail: line };
    }
    if (upper.startsWith("FAIL")) {
      const reason = line.replace(/^FAIL\s*:?\s*/i, "").trim() || line;
      return { ok: false, detail: reason };
    }
  }

  return {
    ok: false,
    detail: "Reviewer did not return a PASS/FAIL verdict. Treat as FAIL.",
  };
}

async function runShellGate(adapter: HarnessAdapter, gate: ShellGate): Promise<GateVerdict> {
  const timeoutMs = (gate.timeout ?? 600) * 1000;
  adapter.setStatus("openspec-loop", `Gate: ${gate.name}…`);
  const result = await adapter.shell(gate.command, { timeoutMs });
  const required = gate.required !== false;

  if (result.code === 0) {
    return { name: gate.name, ok: true, detail: "exit 0" };
  }

  const tail = [result.stderr, result.stdout]
    .filter(Boolean)
    .join("\n")
    .trim()
    .split("\n")
    .slice(-20)
    .join("\n");

  return {
    name: gate.name,
    ok: false,
    required,
    detail: `Command failed (exit ${result.code}): ${gate.command}\n${tail || "(no output)"}`,
  };
}

async function runAgentGate(adapter: HarnessAdapter, gate: AgentGate): Promise<GateVerdict> {
  const required = gate.required !== false;
  if (!adapter.runReviewAgent) {
    return {
      name: gate.name,
      ok: false,
      required,
      detail: "Agent gates require a harness adapter that implements runReviewAgent().",
    };
  }

  adapter.setStatus("openspec-loop", `Review gate: ${gate.name}…`);
  const timeoutMs = (gate.timeout ?? 600) * 1000;
  const prompt = [
    gate.prompt.trim(),
    "",
    "IMPORTANT: Your final answer MUST start with a single line that is either:",
    "PASS",
    "or",
    "FAIL: <short reason>",
    "You may add details after that line.",
  ].join("\n");

  const result = await adapter.runReviewAgent({
    prompt,
    model: gate.model,
    tools: gate.tools,
    timeoutMs,
  });

  if (!result.ok) {
    return {
      name: gate.name,
      ok: false,
      required,
      detail: result.detail || result.output || "Review agent failed to run.",
    };
  }

  const verdict = parseAgentVerdict(result.output);
  const modelNote = gate.model ? ` [model ${gate.model}]` : "";
  if (verdict.ok) {
    return { name: gate.name, ok: true, detail: `${verdict.detail}${modelNote}` };
  }
  return { name: gate.name, ok: false, required, detail: `${verdict.detail}${modelNote}` };
}

export async function runGates(adapter: HarnessAdapter, gates: Gate[]): Promise<GateRunResult> {
  const results: GateVerdict[] = [];

  for (const gate of gates) {
    const verdict =
      gate.type === "shell" ? await runShellGate(adapter, gate) : await runAgentGate(adapter, gate);
    results.push(verdict);
  }

  adapter.setStatus("openspec-loop", undefined);

  const blockReasons = results
    .filter((r): r is Extract<GateVerdict, { ok: false }> => !r.ok && r.required)
    .map((r) => `## ${r.name}\n${r.detail}`);

  return {
    passed: blockReasons.length === 0,
    results,
    blockReasons,
  };
}

export function formatGateSummary(result: GateRunResult): string {
  const lines = result.results.map((r) => {
    const mark = r.ok ? "PASS" : "FAIL";
    return `- ${r.name}: ${mark}${r.detail ? ` — ${r.detail.split("\n")[0]}` : ""}`;
  });
  return ["Gate results:", ...lines].join("\n");
}
