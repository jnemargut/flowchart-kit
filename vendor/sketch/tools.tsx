/** The floating drawing toolbar every kit's editor shares: select, pen, box, oval, line, arrow, text, and a marker color. */
import { useState, type ReactNode } from "react";
import { AnyColor } from "./color";
import { markerHex, MARKER } from "./tokens";

export type DrawTool = "select" | "pen" | "rect" | "ellipse" | "line" | "arrow" | "text";
export const COLORS = ["ink", "grey", "red", "blue", "green", "yellow"] as const;

const ICON: Record<DrawTool, ReactNode> = {
  select: <path d="M6 4 L6 19 L10 15 L13 21 L15.5 20 L12.5 14 L18 14 Z" fill="currentColor" stroke="none" />,
  pen: <path d="M4 19 C7 13, 10 18, 13 11 S 18 7, 20 5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />,
  rect: <rect x={4.5} y={6} width={15} height={12} rx={1.5} fill="none" stroke="currentColor" strokeWidth={2.2} />,
  ellipse: <ellipse cx={12} cy={12} rx={8} ry={6.5} fill="none" stroke="currentColor" strokeWidth={2.2} />,
  line: <path d="M5 19 L19 5" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />,
  arrow: <path d="M5 19 L19 5 M11 5 H19 V13" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />,
  text: <path d="M5 6 H19 M12 6 V19" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />,
};
const LABEL: Record<DrawTool, string> = { select: "Select (V)", pen: "Pen (D)", rect: "Box (R)", ellipse: "Oval (O)", line: "Line (L)", arrow: "Arrow (A)", text: "Text (T)" };

/** The single-key shortcuts that go with the toolbar. */
export const TOOL_KEYS: Record<string, DrawTool> = { v: "select", d: "pen", r: "rect", o: "ellipse", l: "line", a: "arrow", t: "text" };

/** Draw anything the kit's own vocabulary doesn't have, in marker colors. */
export function Tools({ tool, setTool, color, setColor }: { tool: DrawTool; setTool: (t: DrawTool) => void; color: string; setColor: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tools" onPointerDown={(e) => e.stopPropagation()}>
      {(Object.keys(ICON) as DrawTool[]).map((t) => (
        <button key={t} className={tool === t ? "on" : ""} title={LABEL[t]} aria-label={LABEL[t]} onClick={() => setTool(t)}>
          <svg viewBox="0 0 24 24" width={20} height={20}>{ICON[t]}</svg>
        </button>
      ))}
      <div className="tool-color">
        <button title="Marker color" aria-label="Marker color" onClick={() => setOpen(!open)}><span className="dot" style={{ background: markerHex(color) }} /></button>
        {open ? (
          <div className="color-pop">
            {COLORS.map((c) => <button key={c} title={c} aria-label={c} className={c === color ? "on" : ""} onClick={() => { setColor(c); setOpen(false); }}><span className="dot" style={{ background: MARKER[c] }} /></button>)}
            <AnyColor value={color} onPick={(h) => setColor(h)} title="Any marker color" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
