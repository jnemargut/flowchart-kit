/**
 * Simple rich text for every kit: **bold**, *italic* (or _italic_) and ~~strikethrough~~, written right in the
 * text the way people already type it. The marker fonts have no bold or italic faces, so bold is the same ink
 * drawn a touch heavier and italic leans each letter, like handwriting. Both work the same in the browser and
 * in resvg. Kits wrap the plain words with their own measuring, then hand the lines back here for styling.
 */
import type { ReactNode } from "react";

export interface Run { text: string; b?: boolean; i?: boolean; s?: boolean }

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/** Split marked-up text into styled runs. Unclosed markers stay as plain characters. */
export function parseRich(src: string): Run[] {
  const s = String(src ?? "");
  type Tok = { k: "text"; v: string } | { k: "mark"; m: "b" | "i" | "s"; raw: string; open: boolean; close: boolean };
  const toks: Tok[] = [];
  let buf = "";
  const flush = () => { if (buf) { toks.push({ k: "text", v: buf }); buf = ""; } };
  for (let i = 0; i < s.length; i++) {
    const c = s[i], prev = s[i - 1];
    if (c === "\\" && /[*_~\\]/.test(s[i + 1] ?? "")) { buf += s[++i]; continue; }
    const two = s.slice(i, i + 2);
    const mark = two === "**" ? { m: "b" as const, raw: "**" } : two === "~~" ? { m: "s" as const, raw: "~~" } : c === "*" ? { m: "i" as const, raw: "*" } : c === "_" ? { m: "i" as const, raw: "_" } : undefined;
    if (!mark) { buf += c; continue; }
    const after = s[i + mark.raw.length];
    // `_` inside a word (snake_case) is just an underscore
    const open = !isSpace(after) && (mark.raw !== "_" || !isWord(prev));
    const close = !isSpace(prev) && (mark.raw !== "_" || !isWord(after));
    if (!open && !close) { buf += mark.raw; i += mark.raw.length - 1; continue; }
    flush();
    toks.push({ k: "mark", m: mark.m, raw: mark.raw, open, close });
    i += mark.raw.length - 1;
  }
  flush();
  // pair markers with a stack; anything left unpaired is literal text
  const pairedWith = new Map<number, number>();
  const stack: number[] = [];
  toks.forEach((t, idx) => {
    if (t.k !== "mark") return;
    const top = [...stack].reverse().find((j) => (toks[j] as Extract<Tok, { k: "mark" }>).raw === t.raw);
    if (t.close && top !== undefined) {
      pairedWith.set(top, idx); pairedWith.set(idx, top);
      stack.splice(stack.lastIndexOf(top), 1);
    } else if (t.open) stack.push(idx);
  });
  const out: Run[] = [];
  const style = { b: 0, i: 0, s: 0 };
  const push = (text: string) => {
    if (!text) return;
    const r: Run = { text, ...(style.b ? { b: true } : {}), ...(style.i ? { i: true } : {}), ...(style.s ? { s: true } : {}) };
    const last = out[out.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i && !!last.s === !!r.s) last.text += text; else out.push(r);
  };
  toks.forEach((t, idx) => {
    if (t.k === "text") { push(t.v); return; }
    const other = pairedWith.get(idx);
    if (other === undefined) { push(t.raw); return; }
    style[t.m] += other > idx ? 1 : -1;
  });
  return out;
}

/** The words without any markers: what kits measure and wrap. */
export const plainText = (src: string) => parseRich(src).map((r) => r.text).join("");
export const isRich = (src: string) => parseRich(src).some((r) => r.b || r.i || r.s);

/**
 * Put the styles back on lines a kit has already wrapped from `plainText(src)`. Wrappers drop spaces at line
 * breaks and may cut long words, so this walks the plain text and matches each line's characters in order.
 */
export function styleLines(src: string, lines: string[]): Run[][] {
  const runs = parseRich(src);
  const chars: { c: string; r: Run }[] = runs.flatMap((r) => [...r.text].map((c) => ({ c, r })));
  let at = 0;
  return lines.map((line) => {
    const out: Run[] = [];
    for (const ch of line) {
      while (at < chars.length && chars[at].c !== ch && /\s/.test(chars[at].c)) at++;
      const src = at < chars.length && chars[at].c === ch ? chars[at++].r : undefined;
      const last = out[out.length - 1];
      const style = { b: src?.b, i: src?.i, s: src?.s };
      if (last && !!last.b === !!style.b && !!last.i === !!style.i && !!last.s === !!style.s) last.text += ch;
      else out.push({ text: ch, ...(style.b ? { b: true } : {}), ...(style.i ? { i: true } : {}), ...(style.s ? { s: true } : {}) });
    }
    return out;
  });
}

/** The tspans for one line. `ink` is the text color (bold draws a hairline of it around the letters). */
export function RichRuns({ runs, ink, size }: { runs: Run[]; ink: string; size: number }): ReactNode {
  return runs.map((r, k) => (
    <tspan key={k}
      {...(r.b ? { stroke: ink, strokeWidth: Math.max(0.5, size * 0.045), strokeLinejoin: "round" as const, paintOrder: "fill" } : {})}
      {...(r.i ? { rotate: [...r.text].map(() => 13).join(" ") } : {})}
      {...(r.s ? { textDecoration: "line-through" } : {})}>{r.text}</tspan>
  ));
}

/** A line of text that may carry styles: plain text when it doesn't (the common case stays tiny). */
export function RichLine({ src, line, ink, size }: { src?: string; line: Run[] | string; ink: string; size: number }): ReactNode {
  if (typeof line === "string") return src && isRich(src) ? <RichRuns runs={styleLines(src, [line])[0]} ink={ink} size={size} /> : line;
  return line.some((r) => r.b || r.i || r.s) ? <RichRuns runs={line} ink={ink} size={size} /> : line.map((r) => r.text).join("");
}

/** The same styles in HTML (editor chrome: titles, lists, Play's header). */
export function RichHTML({ src }: { src: string }): ReactNode {
  return parseRich(src).map((r, k) => {
    let n: ReactNode = r.text;
    if (r.s) n = <s>{n}</s>;
    if (r.i) n = <em>{n}</em>;
    if (r.b) n = <strong>{n}</strong>;
    return <span key={k}>{n}</span>;
  });
}

/** Every wrapped line of `src`, styled, ready to drop into tspans. */
export function richLines(src: string, lines: string[], ink: string, size: number): ReactNode[] {
  if (!isRich(src)) return lines;
  return styleLines(src, lines).map((runs, i) => <RichRuns key={i} runs={runs} ink={ink} size={size} />);
}

/** Wrap the selection in a text field with a marker (or take it off again). For Cmd+B / Cmd+I / Cmd+Shift+X. */
export function toggleMark(value: string, start: number, end: number, mark: "**" | "*" | "~~"): { value: string; start: number; end: number } {
  const before = value.slice(0, start), sel = value.slice(start, end), after = value.slice(end);
  if (before.endsWith(mark) && after.startsWith(mark) && !(mark === "*" && before.endsWith("**") && !before.endsWith("***")))
    return { value: before.slice(0, -mark.length) + sel + after.slice(mark.length), start: start - mark.length, end: end - mark.length };
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2)
    return { value: before + sel.slice(mark.length, -mark.length) + after, start, end: end - mark.length * 2 };
  // keep spaces outside the markers: "**word** " not "**word **"
  const lead = /^\s*/.exec(sel)![0], trail = /\s*$/.exec(sel)![0];
  const core = sel.slice(lead.length, sel.length - trail.length);
  return { value: before + lead + mark + core + mark + trail + after, start: start + lead.length + mark.length, end: start + lead.length + mark.length + core.length };
}

/**
 * Cmd/Ctrl+B, Cmd/Ctrl+I and Cmd/Ctrl+Shift+X in every text box on the page. Call once when an editor starts.
 * Works with React's controlled inputs too (it sets the value the way React listens for).
 */
export function installRichKeys(doc: Document = document) {
  doc.addEventListener("keydown", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !el || !("selectionStart" in el) || (el.tagName !== "TEXTAREA" && el.type !== "text")) return;
    const k = e.key.toLowerCase();
    const mark = k === "b" && !e.shiftKey ? "**" : k === "i" && !e.shiftKey ? "*" : k === "x" && e.shiftKey ? "~~" : undefined;
    if (!mark || el.selectionStart === null || el.selectionEnd === null) return;
    e.preventDefault();
    e.stopPropagation();
    const r = toggleMark(el.value, el.selectionStart, el.selectionEnd, mark);
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, r.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.setSelectionRange(r.start, r.end);
  }, true);
}
