/**
 * Device bodies around a screen of any size, in the same marker style as Storyboard Kit's devices:
 * a gray fill sitting slightly off an ink outline. The screen area is (x, y, w, h); the body grows around it.
 */
import { C } from "./tokens";

export type ChromeKind = "phone" | "tablet" | "watch" | "laptop" | "desktop" | "plain";

export interface ChromeInsets { l: number; t: number; r: number; b: number; rx: number; screenRx: number; below: number; side: number }

/** Pick a body for a screen size when nobody said. */
export function chromeFor(w: number, h: number): ChromeKind {
  if (w <= 240 && h <= 300) return "watch";
  if (w < 600) return "phone";
  if (w < 1100) return "tablet";
  return "desktop";
}

/** How far the body reaches past the screen on each side (`below`/`side` = stand or base beyond the body). */
export function chromeInsets(kind: ChromeKind): ChromeInsets {
  switch (kind) {
    case "phone": return { l: 16, t: 42, r: 16, b: 42, rx: 50, screenRx: 14, below: 0, side: 0 };
    case "tablet": return { l: 28, t: 28, r: 28, b: 28, rx: 36, screenRx: 8, below: 0, side: 0 };
    case "watch": return { l: 20, t: 20, r: 20, b: 20, rx: 54, screenRx: 38, below: 46, side: 0 };
    case "laptop": return { l: 20, t: 20, r: 20, b: 20, rx: 16, screenRx: 4, below: 30, side: 70 };
    case "desktop": return { l: 22, t: 22, r: 22, b: 22, rx: 12, screenRx: 3, below: 96, side: 0 };
    default: return { l: 8, t: 8, r: 8, b: 8, rx: 10, screenRx: 4, below: 0, side: 0 };
  }
}

const SW = 3.6;
const OFF = { x: 6, y: 5 };

/** The body, drawn behind a screen at (x, y, w, h). Put the screen's own art on top. */
export function DeviceChrome({ kind, x = 0, y = 0, w, h }: { kind: ChromeKind; x?: number; y?: number; w: number; h: number }) {
  const i = chromeInsets(kind);
  const bx = x - i.l, by = y - i.t, bw = w + i.l + i.r, bh = h + i.t + i.b;
  const body = (fill: string, stroke: string, sw: number) => <rect x={bx} y={by} width={bw} height={bh} rx={i.rx} fill={fill} stroke={stroke} strokeWidth={sw} />;
  const extras = (fill: string, stroke: string, sw: number) => {
    if (kind === "laptop") {
      const top = by + bh, base = 26;
      return <path d={`M${bx - i.side} ${top + 4} L${bx + bw + i.side} ${top + 4} L${bx + bw + i.side - 26} ${top + base} L${bx - i.side + 26} ${top + base} Z`} fill={fill === "none" ? "none" : C.g4} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    }
    if (kind === "desktop") {
      const cx = bx + bw / 2, top = by + bh;
      return <path d={`M${cx - 26} ${top} L${cx - 32} ${top + 78} M${cx + 26} ${top} L${cx + 32} ${top + 78} M${cx - 120} ${top + 88} H${cx + 120}`} fill="none" stroke={stroke === "none" ? C.g7 : stroke} strokeWidth={sw || 10} strokeLinecap="round" />;
    }
    if (kind === "watch") {
      const cx = bx + bw / 2, bandW = bw * 0.6;
      return <path d={`M${cx - bandW / 2} ${by} L${cx - bandW / 2 + 8} ${by - i.below} H${cx + bandW / 2 - 8} L${cx + bandW / 2} ${by} M${cx - bandW / 2} ${by + bh} L${cx - bandW / 2 + 8} ${by + bh + i.below} H${cx + bandW / 2 - 8} L${cx + bandW / 2} ${by + bh}`} fill={fill === "none" ? "none" : C.g4} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    }
    return null;
  };
  return (
    <g>
      <g transform={`translate(${OFF.x} ${OFF.y})`}>{extras(C.g7, "none", 0)}{body(C.g7, "none", 0)}</g>
      {extras("none", C.ink, SW)}
      {body("none", C.ink, SW)}
      <rect x={x} y={y} width={w} height={h} rx={i.screenRx} fill={C.paper} stroke={C.ink} strokeWidth={2} />
    </g>
  );
}
