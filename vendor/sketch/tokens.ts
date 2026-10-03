/**
 * Marker Comp: the shared drawing tokens for Storyboard Kit and Wireframe Kit.
 * Grays for the world, teal for the product (and nothing else), orange for what a person does.
 */
export const C = {
  ink: "#1c1c1e",
  paper: "#fbfaf7",
  g1: "#e4e6e8",
  g2: "#d7dade",
  g4: "#b9bec4",
  g5: "#959ba2",
  g7: "#6f777f",
  g8: "#4d535a",
  teal: "#0e9aa7",
  tealDark: "#0b7f8a",
  tealTint: "#8fd6dc",
  caption: "#fff6bf",
  /** Gestures/interactions: what the person does. Orange so it reads on top of teal screens. */
  action: "#e8590c",
} as const;

/** Marker colors. Yellow is a highlighter: wide and see-through. */
export const MARKER: Record<string, string> = { ink: "#1c1c1e", grey: "#6f777f", red: "#d9363e", blue: "#2f6fd0", green: "#2f9e44", yellow: "#f7c948" };

/** "#rgb" or "#rrggbb": any color, wherever a kit offers named colors. */
export const isHex = (v: unknown): boolean => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
/** "#abc" → "#aabbcc", lowercased. */
export const normHex = (v: string) => (v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v).toLowerCase();
/** Is this hex dark enough that words on it should be light? (relative luminance) */
export function isDarkColor(c: string): boolean {
  if (!isHex(c)) return false;
  const h = normHex(c);
  const lin = (i: number) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5) < 0.22;
}
/** A marker color name or a hex, as a CSS color. */
export const markerHex = (c: string | undefined, fallback: string = MARKER.ink): string => (c && isHex(c) ? normHex(c) : (c && MARKER[c]) || fallback);

export const STROKE = { line: 2.1, detail: 1.3, panel: 2.6 };
/** Marker fills sit slightly off the ink line, like real markers. */
export const OFFSET = { x: 2.2, y: 1.8 };

export const FONT = {
  title: "Permanent Marker",
  hand: "Patrick Hand",
};
