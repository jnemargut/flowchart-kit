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

export const STROKE = { line: 2.1, detail: 1.3, panel: 2.6 };
/** Marker fills sit slightly off the ink line, like real markers. */
export const OFFSET = { x: 2.2, y: 1.8 };

export const FONT = {
  title: "Permanent Marker",
  hand: "Patrick Hand",
};
