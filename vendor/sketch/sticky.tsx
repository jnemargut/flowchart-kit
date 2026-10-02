/**
 * A sticky note that looks stuck on: square paper, a slightly darker glue strip along the top, the bottom-right
 * corner peeling up with its underside showing, and a soft shadow where the paper lifts off the board.
 */
import { C } from "./tokens";

/** Draw the paper only (put the words on top). `tilt` in degrees. */
export function StickyPaper({ x, y, w, h, fill, tilt = 0, line = true }: { x: number; y: number; w: number; h: number; fill: string; tilt?: number; line?: boolean }) {
  const c = Math.min(26, Math.min(w, h) * 0.2); // how big the curl is
  const r = (v: number) => Math.round(v * 10) / 10;
  // the sheet, with its bottom-right corner folded up toward the middle
  const sheet = `M${r(x)} ${r(y)} H${r(x + w)} V${r(y + h - c)} Q${r(x + w - c * 0.15)} ${r(y + h - c * 0.15)} ${r(x + w - c)} ${r(y + h)} H${r(x)} Z`;
  // the underside of the curl
  const flap = `M${r(x + w)} ${r(y + h - c)} Q${r(x + w - c * 0.95)} ${r(y + h - c * 0.95)} ${r(x + w - c)} ${r(y + h)} Q${r(x + w - c * 0.15)} ${r(y + h - c * 0.15)} ${r(x + w)} ${r(y + h - c)} Z`;
  const cx = x + w / 2, cy = y + h / 2;
  return (
    <g transform={tilt ? `rotate(${tilt} ${r(cx)} ${r(cy)})` : undefined}>
      {/* the shadow: tight along the glued top, spreading where the paper lifts */}
      <path d={`M${r(x + 3)} ${r(y + 6)} H${r(x + w + 1)} V${r(y + h - c + 6)} Q${r(x + w - c * 0.2 + 4)} ${r(y + h + 4)} ${r(x + w - c + 2)} ${r(y + h + 6)} H${r(x + 4)} Z`} fill="rgba(28,28,30,.13)" />
      <path d={sheet} fill={fill} stroke={line ? "rgba(28,28,30,.55)" : "none"} strokeWidth={1.3} strokeLinejoin="round" />
      <rect x={x} y={y} width={w} height={Math.min(18, h * 0.16)} fill="rgba(28,28,30,.045)" />
      <path d={flap} fill={fill} stroke="rgba(28,28,30,.45)" strokeWidth={1.1} strokeLinejoin="round" />
      <path d={flap} fill="rgba(255,255,255,.35)" />
      <path d={`M${r(x + w - c)} ${r(y + h)} Q${r(x + w - c * 0.15)} ${r(y + h - c * 0.15)} ${r(x + w)} ${r(y + h - c)}`} fill="none" stroke="rgba(28,28,30,.18)" strokeWidth={2.4} transform="translate(-1.5 -1.5)" />
    </g>
  );
}

/** Paper colors that read as sticky notes. */
export const STICKY_PAPER = { yellow: "#fff3a8", pink: "#ffd6dc", blue: "#d4e6ff", green: "#d3f5dc", gray: "#e6e7e9", caption: C.caption } as const;
