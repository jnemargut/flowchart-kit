import type { MarkupStroke, SketchShape } from "../vendor/sketch/shapes";

export type NodeType = "box" | "pill" | "diamond" | "sticky" | "text" | "card" | "stamp" | "link";
export type StickyColor = "yellow" | "pink" | "blue" | "green" | "gray";
export type Side = "right of" | "left of" | "below" | "above";

/** One thing on the board. Keyed by id in `nodes`. */
export interface FNode {
  /** box (a step, the default) · pill (start or end) · diamond (a decision) · sticky · text · card · stamp · link */
  type?: NodeType;
  text?: string;
  /** The frame it lives in. Leave out for the loose area of the board. */
  frame?: string;
  /** Sticky color (default yellow). */
  /** A sticky's paper: a sticky color name or any hex. */
  color?: StickyColor | string;
  /** Stickies and text: sit right beside this node. Stamps: sit on top of it. */
  near?: string;
  /** Stamps: which one (cursor, star, smiley…). */
  icon?: string;
  /** Stamps on a node: where on it, as fractions of its width and height ([0.5, 0.8] = centered, near the bottom). Default its top-right corner. */
  at?: [number, number];
  /** Cards: "./x.storyboard.json", "./x.storyboard.json#panel", "./x.wireframe.json#screen", or an image. */
  ref?: string;
  /** Cards: show only part of the picture, as fractions [left, top, right, bottom] (the original stays as it is). */
  crop?: [number, number, number, number];
  /** Image cards: false shows the picture as it is, instead of sketchified in grays. */
  sketch?: boolean;
  /** A web address (a site, a ticket, a prototype). Link cards show it; anything else gets a little link badge you can click. */
  url?: string;
  /** Teal outline: this is where the product shows up (steps without it are the person's own world). */
  product?: boolean;
  /** Text size: s, m (default), l, xl. */
  size?: TextSize;
  /** Fill: white, paper, light, mid, dark, yellow, pink, blue, green, teal, none. */
  fill?: string;
  /** Border: a marker color, teal, or none. */
  stroke?: string;
  /** Border weight: thin, normal (default), thick. */
  weight?: Weight;
}

export type TextSize = "s" | "m" | "l" | "xl";
export type Connector = "curved" | "angled" | "straight";
export type Weight = "thin" | "normal" | "thick";
export type Side4 = "left" | "right" | "top" | "bottom";

export interface Frame {
  title?: string;
  /** Where this frame goes, next to another one: ["right of", "happy"]. The canvas finds the nearest free spot. */
  near?: [Side, string];
  /** Which way its flow runs: "right" (default) or "down". */
  dir?: "right" | "down";
  /** Speaker notes for when this frame is a slide. */
  notes?: string;
  /** The designer's drawings inside this frame, in frame coordinates (they move with it). */
  shapes?: SketchShape[];
  /** A web address for the whole frame (the spec, the epic, the prototype). */
  url?: string;
  /** A minimum size the designer dragged it out to, [w, h]. */
  size?: [number, number];
}

export interface Link {
  from: string;
  to: string;
  label?: string;
  /** "dashed" for maybe or later, "dotted" for a weaker connection. */
  style?: "solid" | "dashed" | "dotted";
  /** Connector shape: curved, angled (right-angle elbows) or straight. Default: the board's `connectors`. */
  shape?: Connector;
  /** Arrowheads: end (default), start, both, or none (a plain line). */
  head?: "end" | "start" | "both" | "none";
  /** A marker color (default gray ink). */
  color?: string;
  /** Line weight: thin, normal (default), thick. */
  weight?: Weight;
  /** Which side of each box it leaves and arrives on. Leave out and the layout picks. */
  fromSide?: Side4;
  toSide?: Side4;
}

/**
 * Manual adjustments written by the editor, keyed by node id. `x`/`y` pin a node in place (frame coordinates):
 * the editor pins everything once you edit by hand, so later changes never shuffle what you've arranged.
 * Unpinned nodes are laid out automatically, plus any `dx`/`dy` nudge.
 */
export interface Nudge { x?: number; y?: number; dx?: number; dy?: number; w?: number; h?: number }

export interface FlowchartFile {
  $schema?: string;
  title: string;
  frames?: Record<string, Frame>;
  nodes: Record<string, FNode>;
  links?: Link[];
  /** Frames in presenting order. Default: the order they're listed. */
  present?: string[];
  /** How links are drawn unless a link says otherwise: "curved" (default), "angled" or "straight". */
  connectors?: Connector;
  /** Between slides in Play: "fade" (default) or "cut". */
  transition?: "fade" | "cut";
  /** The designer's drawings outside any frame, in canvas coordinates. */
  shapes?: SketchShape[];
  /** Play-mode sharpie, per frame id ("" = the whole board), in that frame's coordinates. */
  markup?: Record<string, MarkupStroke[]>;
  /** Designer nudges and sizes, per node id. */
  layout?: Record<string, Nudge>;
  /** Where frames sit (their top-left), once the designer moved them. "" is the loose area. */
  canvas?: Record<string, [number, number]>;
}

export const typeOf = (n: FNode): NodeType => n.type ?? "box";
export const isNote = (n: FNode) => n.type === "sticky" || n.type === "text" || n.type === "stamp" || n.type === "link";
export const frameOf = (n: FNode) => n.frame ?? "";

/** What a card shows, worked out by whoever has the files (the CLI or the dev server). */
export interface CardInfo {
  /** ok · stale (cached picture, its kit isn't installed to refresh it) · missing (no such file) · nokit (no picture yet, kit not installed) · unknown (no such panel/screen) */
  state: "ok" | "stale" | "missing" | "nokit" | "unknown";
  kind: "storyboard" | "wireframe" | "image";
  /** Absolute path of the picture, when there is one. */
  png?: string;
  /** Picture size in px. */
  w?: number;
  h?: number;
  /** Is it a whole board/flow rather than one panel or screen? */
  whole?: boolean;
  /** One line for the label under the card. */
  label: string;
  /** Why it isn't showing, for missing/nokit/unknown. */
  problem?: string;
}
export type Cards = Record<string, CardInfo>;
