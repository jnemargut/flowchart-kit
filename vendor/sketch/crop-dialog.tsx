/**
 * Quick crop for any picture in any kit: drag the box to move it, its corners and edges to resize it. The kits save
 * the crop as fractions of the original ([left, top, right, bottom]), so the original is never lost.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE } from "react";

export type CropBox = [number, number, number, number];
type Grip = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MIN = 0.04;

export function CropDialog({ src, crop, onDone, onCancel }: { src: string; crop?: CropBox; onDone: (c: CropBox | undefined) => void; onCancel: () => void }) {
  const [c, setC] = useState<CropBox>(crop ?? [0, 0, 1, 1]);
  const img = useRef<HTMLDivElement>(null);
  const drag = useRef<{ grip: Grip; x: number; y: number; start: CropBox } | null>(null);

  const round = (b: CropBox): CropBox | undefined => {
    const r = b.map((v) => Math.round(v * 1000) / 1000) as CropBox;
    return r[0] <= 0.001 && r[1] <= 0.001 && r[2] >= 0.999 && r[3] >= 0.999 ? undefined : r;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
      if (e.key === "Enter") { e.stopPropagation(); onDone(round(c)); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const down = (grip: Grip) => (e: RPE) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { grip, x: e.clientX, y: e.clientY, start: c };
  };
  const move = (e: RPE) => {
    const d = drag.current, r = img.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = (e.clientX - d.x) / r.width, dy = (e.clientY - d.y) / r.height;
    let [l, t, rr, b] = d.start;
    if (d.grip === "move") {
      const w = rr - l, h = b - t;
      l = clamp(l + dx, 0, 1 - w); t = clamp(t + dy, 0, 1 - h); rr = l + w; b = t + h;
    } else {
      if (d.grip.includes("w")) l = clamp(l + dx, 0, rr - MIN);
      if (d.grip.includes("e")) rr = clamp(rr + dx, l + MIN, 1);
      if (d.grip.includes("n")) t = clamp(t + dy, 0, b - MIN);
      if (d.grip.includes("s")) b = clamp(b + dy, t + MIN, 1);
    }
    setC([l, t, rr, b]);
  };
  const up = () => { drag.current = null; };

  const pct = (v: number) => `${v * 100}%`;
  const grip = (g: Grip, x: number, y: number): CSSProperties => ({ position: "absolute", left: pct(x), top: pct(y), width: 14, height: 14, marginLeft: -7, marginTop: -7, background: "#fff", border: "2px solid #0e9aa7", borderRadius: 3, cursor: `${g}-resize`, touchAction: "none" });
  const btn: CSSProperties = { font: "inherit", fontSize: 14, padding: "6px 14px", border: "1.5px solid #fbfaf7", background: "none", color: "#fbfaf7", cursor: "pointer" };

  return (
    <div role="dialog" aria-label="Crop the picture" onPointerMove={move} onPointerUp={up} onPointerDown={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(28,28,30,.82)", display: "grid", placeItems: "center", fontFamily: "'Work Sans', system-ui, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", maxWidth: "92vw" }}>
        <div ref={img} style={{ position: "relative", lineHeight: 0, userSelect: "none", touchAction: "none" }}>
          <img src={src} alt="" draggable={false} style={{ maxWidth: "86vw", maxHeight: "72vh", display: "block" }} />
          {/* the parts that get cut away */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(28,28,30,.55)", clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(c[0])} ${pct(c[1])}, ${pct(c[0])} ${pct(c[3])}, ${pct(c[2])} ${pct(c[3])}, ${pct(c[2])} ${pct(c[1])}, ${pct(c[0])} ${pct(c[1])})` }} />
          <div onPointerDown={down("move")} style={{ position: "absolute", left: pct(c[0]), top: pct(c[1]), width: pct(c[2] - c[0]), height: pct(c[3] - c[1]), border: "2px solid #0e9aa7", boxSizing: "border-box", cursor: "move", touchAction: "none" }} />
          {([["nw", c[0], c[1]], ["n", (c[0] + c[2]) / 2, c[1]], ["ne", c[2], c[1]], ["e", c[2], (c[1] + c[3]) / 2], ["se", c[2], c[3]], ["s", (c[0] + c[2]) / 2, c[3]], ["sw", c[0], c[3]], ["w", c[0], (c[1] + c[3]) / 2]] as [Grip, number, number][]).map(([g, x, y]) => <span key={g} onPointerDown={down(g)} style={grip(g, x, y)} />)}
        </div>
        <div style={{ display: "flex", gap: 10, color: "#fbfaf7", alignItems: "center" }}>
          <span style={{ fontSize: 13, opacity: 0.75, marginRight: 8 }}>Drag the box or its handles. Enter to keep, Esc to cancel.</span>
          <button style={btn} onClick={() => setC([0, 0, 1, 1])}>Show it all</button>
          <button style={btn} onClick={onCancel}>Cancel</button>
          <button style={{ ...btn, background: "#fbfaf7", color: "#1c1c1e", fontWeight: 600 }} onClick={() => onDone(round(c))}>Crop</button>
        </div>
      </div>
    </div>
  );
}
