/** Which characters the bundled fonts can draw. No Node built-ins, so checkers in the editors can use it too. */

/**
 * Characters none of the bundled fonts can draw: they'd silently disappear from a render. Checkers warn about
 * these and suggest a word, a stamp or an icon instead.
 */
export function undrawable(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of String(text ?? "")) {
    if (/[★☆♡❤✔✗✘✖✕☑☐☒⭐✅❌➜➔⇒⇐⇨]/u.test(ch) || (/\p{Extended_Pictographic}/u.test(ch) && !/[©®™‼⁉♥↔↕]/u.test(ch))) bad.add(ch);
  }
  return [...bad];
}

/** Every string in a file that has characters nobody can draw, with where it is (for a checker's warnings). */
export function findUndrawable(value: unknown, path = "$"): { path: string; chars: string[] }[] {
  const out: { path: string; chars: string[] }[] = [];
  const walk = (v: unknown, p: string) => {
    if (typeof v === "string") { const c = undrawable(v); if (c.length) out.push({ path: p, chars: c }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk(value, path);
  return out;
}

/** The warning text for one of those. */
export const undrawableHint = (chars: string[]) => ({
  message: `The marker fonts can't draw ${chars.map((c) => `"${c}"`).join(", ")}: ${chars.length > 1 ? "they'd" : "it'd"} disappear from the picture.`,
  hint: "Use a word instead (\"done\", \"no\", \"best\"), or a stamp or icon where the kit has one. Arrows (→ ← ↑ ↓) and ✓ are fine.",
});
