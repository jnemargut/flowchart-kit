/** Pan and zoom for an infinite canvas: the view transform, wheel handling, and fitting a box on screen. */
import { useEffect, type RefObject } from "react";

export interface View { x: number; y: number; k: number }
export interface Box { x: number; y: number; w: number; h: number }

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;

/** Zoom by `factor` around a point on screen (cx, cy), keeping that point still. */
export function zoomAt(v: View, factor: number, cx: number, cy: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
  return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
}

/** The view that shows `b` centered in a `w × h` viewport, with `pad` around it, never zoomed past `maxK`. */
export function fitView(b: Box, w: number, h: number, pad = 40, maxK = 1): View {
  const k = Math.max(MIN_ZOOM, Math.min(maxK, (w - pad * 2) / Math.max(1, b.w), (h - pad * 2) / Math.max(1, b.h)));
  return { k, x: (w - b.w * k) / 2 - b.x * k, y: (h - b.h * k) / 2 - b.y * k };
}

/** Screen point → canvas point. */
export const toWorld = (v: View, sx: number, sy: number) => ({ x: (sx - v.x) / v.k, y: (sy - v.y) / v.k });

/** Pinch or Ctrl/Cmd+wheel zooms around the cursor; a plain wheel pans. `skip` lets text fields scroll. */
export function useWheelView(ref: RefObject<HTMLElement | null>, setView: (f: (v: View) => View) => void, skip = ".inline-edit") {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest(skip)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) setView((v) => zoomAt(v, Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref, setView, skip]);
}
