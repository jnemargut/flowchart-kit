/**
 * Quiet controls for Play: what's being shown is all that's on screen. The controls appear when the mouse really
 * moves and step aside a moment after it stops, unless it's resting on them. Shared by every kit's Play mode.
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";

/**
 * `controls` is a CSS selector for the controls (so resting the mouse on them keeps them up).
 * Returns `awake` (show the controls), `tip` (true for the first few seconds, for a one-time hint) and the
 * `onPointerMove` to put on Play's root element.
 */
export function useQuietControls(controls: string, o: { linger?: number; first?: number } = {}) {
  const linger = o.linger ?? 2200, first = o.first ?? 4500;
  const [awake, setAwake] = useState(true);
  const [tip, setTip] = useState(true);
  const last = useRef<{ x: number; y: number } | null>(null);
  const over = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const arm = (ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (!over.current) setAwake(false); }, ms);
  };
  useEffect(() => {
    arm(first);
    const t = window.setTimeout(() => setTip(false), first);
    return () => { window.clearTimeout(t); window.clearTimeout(timer.current); };
  }, []);
  const onPointerMove = (e: PointerEvent) => {
    // a browser sends a "move" when something new appears under a still mouse: only a change of place counts
    const was = last.current;
    last.current = { x: e.clientX, y: e.clientY };
    if (!was || (was.x === e.clientX && was.y === e.clientY)) return;
    over.current = !!(e.target as Element | null)?.closest?.(controls);
    setAwake(true);
    arm(linger);
  };
  return { awake, tip, onPointerMove };
}
