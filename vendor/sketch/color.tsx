/**
 * Any color, minimally: the last dot in every color row. "+" opens the system color picker, a hex field and (in
 * browsers that have one) a dropper that picks any pixel on screen. Colors you've used come back as dots.
 * Values are stored as "#rrggbb", which every kit's renderer and checker accept next to its named colors.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isHex, normHex } from "./tokens";

const KEY = "sketch:recent-colors";
const MAX = 5;

function recent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter(isHex).slice(0, MAX) : []; } catch { return []; }
}
function forget(hex: string) {
  try { localStorage.setItem(KEY, JSON.stringify(recent().filter((c) => c.toLowerCase() !== hex.toLowerCase()))); window.dispatchEvent(new Event(KEY)); } catch { /* fine */ }
}
function remember(hex: string) {
  try { localStorage.setItem(KEY, JSON.stringify([hex, ...recent().filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX))); window.dispatchEvent(new Event(KEY)); } catch { /* private window: fine */ }
}

type Dropper = { open: () => Promise<{ sRGBHex: string }> };
const dropper = (): (new () => Dropper) | undefined => (typeof window !== "undefined" ? (window as unknown as { EyeDropper?: new () => Dropper }).EyeDropper : undefined);

const dot = (bg: string, square?: boolean) => ({ width: 18, height: 18, borderRadius: square ? 4 : 9, background: bg, border: "1.5px solid rgba(0,0,0,0.35)", display: "block" });
const btn = { width: 26, height: 28, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0 } as const;

/**
 * Put it right after a row of preset swatches. `value` is the current color (a preset name or a hex);
 * `onPick` gets a "#rrggbb". `square` matches square fill swatches.
 */
export function AnyColor({ value, onPick, square, title = "Any color" }: { value?: string; onPick: (hex: string) => void; square?: boolean; title?: string }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<string[]>(recent);
  const [draft, setDraft] = useState(isHex(value) ? normHex(value!) : "");
  const wrap = useRef<HTMLSpanElement>(null);
  const plus = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  // the picker floats over the page (not inside a scrolling panel that would clip it), kept inside the window
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) { setAt(null); return; }
    const place = () => {
      const b = plus.current?.getBoundingClientRect(), p = pop.current?.getBoundingClientRect();
      if (!b) return;
      const w = p?.width ?? 200, h = p?.height ?? 44;
      const left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8));
      const top = b.bottom + 4 + h > window.innerHeight - 8 ? b.top - 4 - h : b.bottom + 4;
      setAt({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => { const f = () => setList(recent()); window.addEventListener(KEY, f); return () => window.removeEventListener(KEY, f); }, []);
  useEffect(() => { if (isHex(value)) setDraft(normHex(value!)); }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node) && !pop.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [open]);
  const pick = (c: string) => { const h = normHex(c); remember(h); onPick(h); setDraft(h); };
  const cur = isHex(value) ? normHex(value!) : undefined;
  const shown = cur && !list.some((c) => c.toLowerCase() === cur.toLowerCase()) ? [cur, ...list] : list;
  const ED = dropper();
  return (
    <span ref={wrap} style={{ position: "relative", display: "inline-flex", flexShrink: 0, gap: 2 }} onPointerDown={(e) => e.stopPropagation()}>
      {shown.slice(0, MAX).map((c) => (
        <button key={c} type="button" title={`${c} (Option-click to forget it)`} aria-label={c} className={cur && c.toLowerCase() === cur.toLowerCase() ? "on" : ""} style={btn}
          onClick={(e) => (e.altKey ? forget(c) : pick(c))}><span style={dot(c, square)} /></button>
      ))}
      <button ref={plus} type="button" title={title} aria-label={title} aria-expanded={open} style={btn} onClick={() => setOpen(!open)}>
        <span style={{ ...dot("conic-gradient(#d9363e, #f7c948, #2f9e44, #2f6fd0, #9b4dca, #d9363e)", square), position: "relative" }}>
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1, textShadow: "0 0 2px #000" }}>+</span>
        </span>
      </button>
      {open ? createPortal(
        <span ref={pop} role="dialog" aria-label="Pick any color" onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", zIndex: 1000, left: at?.left ?? -9999, top: at?.top ?? -9999, display: "flex", gap: 6, alignItems: "center", background: "var(--color-paper, #fbfaf7)", border: "2px solid var(--color-ink, #1c1c1e)", padding: 6, boxShadow: "3px 4px 0 rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>
          <input type="color" aria-label="Color picker" value={isHex(draft) ? normHex(draft) : "#e8b04b"} onChange={(e) => pick(e.target.value)} style={{ width: 32, height: 28, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
          <input aria-label="Hex color" placeholder="#e8b04b" value={draft} size={8} spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && isHex(draft)) { pick(draft); setOpen(false); } if (e.key === "Escape") setOpen(false); }}
            onBlur={() => { if (isHex(draft) && normHex(draft) !== cur) pick(draft); }}
            style={{ font: "13px ui-monospace, Menlo, monospace", width: 82, padding: "4px 6px", border: "1.5px solid var(--color-300, #b9bec4)" }} />
          {ED ? (
            <button type="button" title="Pick a color from anywhere on screen" aria-label="Dropper" style={{ ...btn, width: 30 }}
              onClick={async () => { try { const r = await new ED().open(); pick(r.sRGBHex); } catch { /* cancelled */ } }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M17 2.5a2.1 2.1 0 0 1 3 3l-3 3-3-3z M14 6.5L5.5 15 4 20l5-1.5L17.5 10" /></svg>
            </button>
          ) : null}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}
