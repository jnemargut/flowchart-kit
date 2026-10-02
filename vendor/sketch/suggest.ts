/** "Did you mean …?" for agent-written files: edit distance with a little forgiveness for case, dashes and spaces. */
export function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const norm = (x: string) => x.toLowerCase().replace(/[-_\s]/g, "");

export function suggest(value: string, options: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const o of options) {
    const d = norm(o) === norm(value) ? 0 : o.includes(value) || value.includes(o) ? 1.5 : distance(value, o);
    if (d < bestD) { bestD = d; best = o; }
  }
  return bestD <= Math.max(2, Math.floor(value.length / 3)) ? best : undefined;
}

export interface Issue {
  path: string;
  message: string;
  hint?: string;
}

export interface Result {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/** Errors (✗) then suggestions (!), each with its fix. */
export function formatIssues(r: Result, file: string, summary?: string): string {
  const lines: string[] = [];
  for (const e of r.errors) lines.push(`✗ ${e.path}: ${e.message}${e.hint ? `\n    → ${e.hint}` : ""}`);
  for (const w of r.warnings) lines.push(`! ${w.path}: ${w.message}${w.hint ? `\n    → ${w.hint}` : ""}`);
  if (r.ok) lines.unshift(`✓ ${file} is valid${summary ? ` (${summary})` : ""}${r.warnings.length ? `, ${r.warnings.length} suggestion(s)` : ""}`);
  else lines.unshift(`✗ ${file}: ${r.errors.length} error(s)`);
  return lines.join("\n");
}
