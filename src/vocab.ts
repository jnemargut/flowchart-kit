/**
 * The closed vocabulary: node types, sticky colors, frame relations. The schema, the checker, the docs and the
 * editor's palette all read from here.
 */
import type { NodeType, Side, StickyColor } from "./types";

export interface NodeDef {
  type: NodeType;
  /** What it's for, in a sentence. */
  doc: string;
  /** Palette label. */
  label: string;
  example: Record<string, unknown>;
}

export const NODE_TYPES: Record<NodeType, NodeDef> = {
  box: { type: "box", label: "Step", doc: "A step: something a person or the product does. The default, so you can leave `type` out.", example: { text: "Orders a latte ahead", frame: "happy" } },
  pill: { type: "pill", label: "Start / end", doc: "Where a flow starts or ends.", example: { type: "pill", text: "Leaves home", frame: "happy" } },
  diamond: { type: "diamond", label: "Decision", doc: "A question with more than one way out. Label the links that leave it (\"yes\", \"no\").", example: { type: "diamond", text: "Ready on time?", frame: "happy" } },
  sticky: { type: "sticky", label: "Sticky", doc: "A sticky note: a question, an insight, an idea. `near` sticks it beside a node; `color` picks the paper.", example: { type: "sticky", text: "Is \"4 min\" ever true at 8am?", color: "pink", near: "ready" } },
  text: { type: "text", label: "Text", doc: "Loose hand-written words: a heading, a lane name, a comment. `near` puts it beside a node.", example: { type: "text", text: "Nobody tells them it's late", near: "wait" } },
  stamp: { type: "stamp", label: "Stamp", doc: "A little marker icon: a click cursor on a screen, a star on what matters, a smiley or a frown on a feeling. `near` puts it on top of a node, `at` says where on it.", example: { type: "stamp", icon: "cursor", near: "status-screen", at: [0.5, 0.82] } },
  link: { type: "link", label: "Link", doc: "A web page as a card: a site, a ticket, a doc, a prototype. `text` is its title, `url` where it goes. (Any other node can carry a `url` too.)", example: { type: "link", text: "ORDER-412: late order alerts", url: "https://example.atlassian.net/browse/ORDER-412", near: "late-alert" } },
  card: { type: "card", label: "Card", doc: "A storyboard, a storyboard panel, a wireframe flow or screen, or an image, pointed at by `ref` and drawn by its own kit. Link to and from it like any step.", example: { type: "card", ref: "./late-latte.storyboard.json#in-line", frame: "late" } },
};
export const TYPES = Object.keys(NODE_TYPES) as NodeType[];

/** Sticky papers: fill, and a darker edge for the editor. */
export const STICKY: Record<StickyColor, { fill: string; doc: string }> = {
  yellow: { fill: "#fff6bf", doc: "the default: notes, observations" },
  pink: { fill: "#fde2e4", doc: "questions, worries, pain points" },
  blue: { fill: "#dbeafe", doc: "ideas" },
  green: { fill: "#dcfce7", doc: "what works, decisions made" },
  gray: { fill: "#e4e6e8", doc: "parked, out of scope" },
};
export const STICKY_COLORS = Object.keys(STICKY) as StickyColor[];

/** Stamps: what each is for. Drawn in marker style; the cursor is orange like every gesture in the kits. */
export const STAMPS: Record<string, string> = {
  cursor: "a click or tap happens here",
  star: "something special, the best bit",
  smiley: "this feels good",
  meh: "this feels so-so",
  frown: "this feels bad",
  heart: "people love this",
  "thumbs-up": "yes, keep it",
  "thumbs-down": "no, cut it",
  question: "an open question",
  alert: "a problem or a risk",
  check: "done, decided, works",
  cross: "wrong, broken, doesn't work",
  idea: "an idea",
  flag: "a milestone, or come back to this",
  clock: "waiting, or it takes time",
  eye: "people look here",
  fire: "urgent, or hot",
  dollar: "money changes hands",
};
export const STAMP_NAMES = Object.keys(STAMPS);

export const SIDES: Side[] = ["right of", "left of", "below", "above"];

/** Node props and what they mean, for the schema and the docs. */
export const NODE_PROPS: Record<string, string> = {
  type: `${TYPES.join(" | ")} (default box)`,
  text: "the words on it",
  frame: "the frame it lives in (leave out for the loose area)",
  color: `stickies: ${STICKY_COLORS.join(" | ")} (default yellow)`,
  near: "stickies and text: the id of the node to sit beside; stamps: the node to sit on top of",
  icon: `stamps: ${STAMP_NAMES.join(" | ")}`,
  at: "stamps on a node: [x, y] as fractions of it (default [1, 0], its top-right corner)",
  ref: "cards: a path to a storyboard, panel, wireframe, screen or image",
  sketch: "image cards: false shows the picture as it is (default: sketchified in grays to match)",
  url: "a web address; link cards show it, anything else gets a clickable link badge",
  product: "true draws it teal: this is where the product shows up",
};

export const FRAME_PROPS: Record<string, string> = {
  title: "the name on the frame (and the slide title in Play)",
  near: `["right of" | "left of" | "below" | "above", "<frame id>"]: placed next to that frame, in the nearest free spot`,
  dir: `"right" (default) or "down": which way its flow runs`,
  notes: "speaker notes for when it's a slide",
  url: "a web address for the whole frame (the spec, the epic, the prototype)",
};

export const LINK_PROPS: Record<string, string> = {
  from: "node id",
  to: "node id",
  label: "a word or two on the arrow (\"yes\", \"no\", \"after 10 min\")",
  style: `"solid" (default) or "dashed" (maybe, later, a weaker link)`,
};
