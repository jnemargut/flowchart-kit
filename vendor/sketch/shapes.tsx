/** Hand-drawn shapes (boxes, ovals, lines, arrows, freehand, free text) and crit markup, in marker style. */
import { plainText, richLines } from "./rich";
import { C, FONT, MARKER } from "./tokens";

/** "rect" | "ellipse" | "line" | "arrow" | "path" | "text" (each kit's vocabulary checks the values). */
export type SketchShapeType = string;
/** "none" | "light" | "mid" | "dark" */
export type SketchFill = string;
/** "ink" | "grey" | "red" | "blue" | "green" | "yellow" */
export type SketchColor = string;
export const SHAPE_TYPES = ["rect", "ellipse", "line", "arrow", "path", "text"] as const;
export const SHAPE_FILLS = ["none", "light", "mid", "dark"] as const;
export const MARKER_COLORS = ["ink", "grey", "red", "blue", "green", "yellow"] as const;

export interface SketchShape {
  id?: string;
  type: SketchShapeType;
  points: [number, number][];
  fill?: SketchFill;
  /** The words, for a "text" shape. */
  text?: string;
  /** Marker color; default ink. */
  color?: SketchColor;
}

/** A sharpie stroke from play mode. */
export interface MarkupStroke {
  points: [number, number][];
  color?: SketchColor;
}

/** Placement tweaks: move, then scale and rotate around the shape's center. */
export interface ShapeOverride { dx?: number; dy?: number; scale?: number; rotate?: number }

const SHAPE_FILL: Record<string, string> = { none: "none", light: C.g2, mid: C.g4, dark: C.g7 };

/** Bounding box of a shape's points, for centering scale and rotate. */
export function shapeBox(s: Pick<SketchShape, "points">): { x: number; y: number; w: number; h: number } {
  const xs = s.points.map((p) => p[0]), ys = s.points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Freehand points → a smooth path through their midpoints. */
export function smooth(pts: [number, number][]): string {
  if (pts.length < 3) return `M${pts.map((p) => p.join(" ")).join(" L")}`;
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

/** One shape in marker style: ink outline, gray fill, round ends. `scale` sizes line widths and text for bigger canvases. */
export function ShapeMark({ s, scale = 1 }: { s: SketchShape; scale?: number }) {
  if (s.type === "text") {
    // hand-lettered, centered on its point; a clear box behind makes it easy to grab
    const [x, y] = s.points[0];
    const lines = (s.text ?? "").split("\n");
    const size = 16 * scale, lh = size * 1.2;
    const w = Math.max(24 * scale, ...lines.map((l) => plainText(l).length * size * 0.45)), h = lines.length * lh;
    const top = y - h / 2 + size * 0.85;
    return (
      <g>
        <rect x={x - w / 2 - 4} y={y - h / 2 - 3} width={w + 8} height={h + 6} fill="transparent" />
        <text textAnchor="middle" fontFamily={FONT.hand} fontSize={size} fill={s.color && s.color !== "yellow" ? MARKER[s.color] : C.ink} stroke={s.color === "yellow" ? MARKER.yellow : C.paper} strokeWidth={3.5 * scale} strokeLinejoin="round" paintOrder="stroke">
          {lines.map((l, i) => <tspan key={i} x={x} y={top + i * lh}>{l ? richLines(l, [plainText(l)], s.color && s.color !== "yellow" ? MARKER[s.color] : C.ink, size)[0] : " "}</tspan>)}
        </text>
      </g>
    );
  }
  const [a, b] = s.points;
  const ink = MARKER[s.color ?? "ink"] ?? C.ink;
  const colored = !!s.color && s.color !== "ink" && s.color !== "grey";
  // gray fills stay gray; a colored shape gets a see-through tint of its own color instead
  const fill = colored && s.fill && s.fill !== "none" ? ink : SHAPE_FILL[s.fill ?? "none"] ?? "none";
  const fillOpacity = colored ? ({ light: 0.18, mid: 0.35, dark: 0.6 } as Record<string, number>)[s.fill ?? "none"] : undefined;
  // closed shapes stay clickable inside even when unfilled
  const area = fill === "none" ? "transparent" : fill;
  const stroke = { stroke: ink, strokeWidth: (s.color === "yellow" ? 5 : 2.4) * scale, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeOpacity: s.color === "yellow" ? 0.75 : undefined, fillOpacity };
  const hit = (d: string) => <path d={d} fill="none" stroke="transparent" strokeWidth={14 * scale} />;
  if (s.type === "rect" || s.type === "ellipse") {
    const r = shapeBox({ points: [a, b] });
    return s.type === "rect"
      ? <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2 * scale} fill={area} {...stroke} />
      : <ellipse cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} fill={area} {...stroke} />;
  }
  if (s.type === "line" || s.type === "arrow") {
    const d = `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), k = 12 * scale;
    const head = s.type === "arrow"
      ? ` M${b[0] - k * Math.cos(ang - 0.45)} ${b[1] - k * Math.sin(ang - 0.45)} L${b[0]} ${b[1]} L${b[0] - k * Math.cos(ang + 0.45)} ${b[1] - k * Math.sin(ang + 0.45)}`
      : "";
    return <g>{hit(d)}<path d={d + head} fill="none" {...stroke} /></g>;
  }
  const d = smooth(s.points);
  return <g>{hit(d)}<path d={d} fill={fill} {...stroke} /></g>;
}

export const shapeId = (s: SketchShape, i: number) => s.id ?? `shape-${i}`;

/** Transform for a shape's override: move, then scale and rotate around its own center. */
export function shapeTransform(s: SketchShape, ov: ShapeOverride): string {
  const r = shapeBox(s);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return `translate(${(ov.dx ?? 0) + cx} ${(ov.dy ?? 0) + cy}) rotate(${ov.rotate ?? 0}) scale(${ov.scale ?? 1}) translate(${-cx} ${-cy})`;
}

/** Sharpie crit markup: thick strokes over everything. `hit` makes strokes clickable (the eraser). */
export function MarkupStrokes({ strokes, hit, scale = 1 }: { strokes: MarkupStroke[]; hit?: boolean; scale?: number }) {
  return (
    <>
      {strokes.map((m, i) => {
        const hl = m.color === "yellow";
        const d = smooth(m.points);
        return (
          <g key={i} data-mk={i}>
            {hit && <path d={d} fill="none" stroke="transparent" strokeWidth={16 * scale} strokeLinecap="round" />}
            <path d={d} fill="none" stroke={MARKER[m.color ?? "red"] ?? MARKER.red} strokeWidth={(hl ? 12 : 4.5) * scale} strokeOpacity={hl ? 0.55 : 0.92} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
    </>
  );
}
