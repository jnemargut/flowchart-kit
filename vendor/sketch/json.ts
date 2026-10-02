/**
 * Deterministic, diff-friendly JSON for agent-written files (storyboards, wireframes).
 * Short objects/arrays stay on one line (like a hand-written file); long ones break across lines.
 * The editor always writes through this, so a nudge changes one line, not the whole file.
 */
const MAX_INLINE = 108;

export function formatJSON(value: unknown): string {
  return fmt(value, 0) + "\n";
}
export const formatStoryboard = formatJSON;

function inlineOf(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(inlineOf).join(", ")}]`;
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inlineOf(x)}`).join(", ")} }` : "{}";
}

function fmt(v: unknown, depth: number): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  const inline = inlineOf(v);
  const pad = "  ".repeat(depth + 1);
  const end = "  ".repeat(depth);
  const fitsInline = depth >= 2 && inline.length + depth * 2 <= MAX_INLINE;
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    if (v.every((x) => x === null || typeof x !== "object") && inline.length <= MAX_INLINE) return inline;
    if (fitsInline) return inline;
    return "[\n" + v.map((x) => pad + fmt(x, depth + 1)).join(",\n") + "\n" + end + "]";
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return "{}";
  if (fitsInline) return inline;
  return "{\n" + entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${fmt(x, depth + 1)}`).join(",\n") + "\n" + end + "}";
}

export type PathSeg = string | number;
export interface Op {
  path: PathSeg[];
  /** Omit together with `delete: true` to remove the key / array item. */
  value?: unknown;
  delete?: boolean;
  /** Insert into an array at path's last index instead of replacing. */
  insert?: boolean;
}

/** Apply field-level edits. Missing intermediate objects are created. */
export function applyOps<T>(doc: T, ops: Op[]): T {
  const root = structuredClone(doc) as unknown as Record<PathSeg, unknown>;
  for (const op of ops) {
    if (op.path.length === 0) continue;
    let cur: Record<PathSeg, unknown> = root;
    for (let i = 0; i < op.path.length - 1; i++) {
      const k = op.path[i];
      if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") cur[k] = typeof op.path[i + 1] === "number" ? [] : {};
      cur = cur[k] as Record<PathSeg, unknown>;
    }
    const last = op.path[op.path.length - 1];
    if (op.delete) {
      if (Array.isArray(cur) && typeof last === "number") cur.splice(last, 1);
      else delete cur[last];
      pruneEmpty(root, op.path.slice(0, -1));
    } else if (op.insert && Array.isArray(cur) && typeof last === "number") {
      cur.splice(last, 0, op.value);
    } else {
      cur[last] = op.value;
    }
  }
  return root as unknown as T;
}

/** Remove now-empty `layout` override objects so files stay clean. */
function pruneEmpty(root: Record<PathSeg, unknown>, path: PathSeg[]) {
  for (let n = path.length; n > 0; n--) {
    const parentPath = path.slice(0, n - 1);
    let parent: Record<PathSeg, unknown> = root;
    for (const k of parentPath) parent = parent[k] as Record<PathSeg, unknown>;
    const key = path[n - 1];
    const v = parent?.[key];
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0 && (key === "layout" || parentPath.includes("layout"))) delete parent[key];
    else break;
  }
}
