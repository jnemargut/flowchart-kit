/** JSON Schema for *.flowchart.json, generated from the vocabulary (editors get autocomplete; the validator is stricter). */
import { MARKER_COLORS, SHAPE_COLORS, SHAPE_FILLS, SHAPE_TYPES, SHAPE_WEIGHTS, TEXT_SIZES as SHAPE_TEXT_SIZES } from "../vendor/sketch/shapes";
import { CHART_COLORS, CHART_KINDS, CONNECTORS, FILL_NAMES, FRAME_PROPS, HEADS, LINE_COLOR_NAMES, LINK_PROPS, LINK_STYLES, NODE_PROPS, SIDES, SIDES4, STAMP_NAMES, STICKY_COLORS, TEXT_SIZES, TYPES, WEIGHTS } from "./vocab";

const point = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 };
const shape = {
  type: "object", required: ["type", "points"],
  properties: { id: { type: "string" }, type: { enum: [...SHAPE_TYPES] }, points: { type: "array", items: point }, fill: { enum: [...SHAPE_FILLS] }, text: { type: "string" }, color: { anyOf: [{ enum: [...SHAPE_COLORS] }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }] }, weight: { enum: [...SHAPE_WEIGHTS] }, size: { enum: [...SHAPE_TEXT_SIZES] }, front: { type: "boolean", description: "Drawn in front of the boxes and cards." }, rotate: { type: "number", description: "Turned around its middle, degrees clockwise." }, locked: { type: "boolean", description: "Stays put until unlocked (editor-owned)." }, group: { type: "string", description: "Moves with others in the same group (editor-owned)." } },
};
const strokes = { type: "array", items: { type: "object", required: ["points"], properties: { points: { type: "array", items: point }, color: { anyOf: [{ enum: [...MARKER_COLORS] }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }] } } } };

export function buildSchema() {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Flowchart Kit board",
    type: "object",
    required: ["title", "nodes"],
    additionalProperties: false,
    properties: {
      $schema: { type: "string" },
      title: { type: "string" },
      frames: {
        type: "object",
        additionalProperties: {
          type: "object", additionalProperties: false,
          properties: {
            title: { type: "string", description: FRAME_PROPS.title },
            near: { description: FRAME_PROPS.near, type: "array", items: [{ enum: SIDES }, { type: "string" }], minItems: 2, maxItems: 2 },
            dir: { enum: ["right", "down"], description: FRAME_PROPS.dir },
            notes: { type: "string", description: FRAME_PROPS.notes },
            url: { type: "string", description: FRAME_PROPS.url },
            shapes: { type: "array", items: shape },
            size: point,
          },
        },
      },
      nodes: {
        type: "object",
        additionalProperties: {
          type: "object", additionalProperties: false,
          properties: {
            type: { enum: TYPES, description: NODE_PROPS.type },
            text: { type: "string", description: NODE_PROPS.text },
            frame: { type: "string", description: NODE_PROPS.frame },
            kind: { enum: [...CHART_KINDS], description: NODE_PROPS.kind },
            data: { anyOf: [{ type: "array", items: { type: "array", items: [{ type: "string" }, { type: "number" }], minItems: 2, maxItems: 2 } }, { type: "object", additionalProperties: { type: "number" } }], description: NODE_PROPS.data },
            highlight: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: NODE_PROPS.highlight },
            unit: { type: "string", description: NODE_PROPS.unit },
            values: { type: "boolean", description: NODE_PROPS.values },
            color: { anyOf: [{ enum: [...STICKY_COLORS, ...CHART_COLORS] }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }], description: NODE_PROPS.color },
            near: { type: "string", description: NODE_PROPS.near },
            icon: { enum: STAMP_NAMES, description: NODE_PROPS.icon },
            at: { ...point, description: NODE_PROPS.at },
            ref: { type: "string", description: NODE_PROPS.ref },
            url: { type: "string", description: NODE_PROPS.url },
            sketch: { type: "boolean", description: NODE_PROPS.sketch },
            mirror: { type: "boolean", description: NODE_PROPS.mirror },
            locked: { type: "boolean", description: "Stays put until unlocked (editor-owned)." },
            group: { type: "string", description: "Selected and moved with others in the same group (editor-owned)." },
            turn: { enum: [0, 90, 180, 270], description: NODE_PROPS.turn },
            crop: { type: "array", items: { type: "number", minimum: 0, maximum: 1 }, minItems: 4, maxItems: 4, description: NODE_PROPS.crop },
            product: { type: "boolean", description: NODE_PROPS.product },
            size: { enum: [...TEXT_SIZES], description: NODE_PROPS.size },
            fill: { anyOf: [{ enum: FILL_NAMES }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }], description: NODE_PROPS.fill },
            stroke: { anyOf: [{ enum: LINE_COLOR_NAMES }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }], description: NODE_PROPS.stroke },
            weight: { enum: [...WEIGHTS], description: NODE_PROPS.weight },
          },
        },
      },
      links: {
        type: "array",
        items: {
          type: "object", required: ["from", "to"], additionalProperties: false,
          properties: { from: { type: "string", description: LINK_PROPS.from }, to: { type: "string", description: LINK_PROPS.to }, label: { type: "string", description: LINK_PROPS.label }, style: { enum: [...LINK_STYLES], description: LINK_PROPS.style }, shape: { enum: [...CONNECTORS], description: LINK_PROPS.shape }, head: { enum: [...HEADS], description: LINK_PROPS.head }, color: { anyOf: [{ enum: LINE_COLOR_NAMES.filter((c) => c !== "none") }, { type: "string", pattern: "^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", description: "Any color as a hex, e.g. \"#e8b04b\"." }], description: LINK_PROPS.color }, weight: { enum: [...WEIGHTS], description: LINK_PROPS.weight }, fromSide: { enum: [...SIDES4], description: LINK_PROPS.fromSide }, toSide: { enum: [...SIDES4], description: LINK_PROPS.toSide }, bend: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: LINK_PROPS.bend }, size: { enum: [...TEXT_SIZES], description: LINK_PROPS.size } },
        },
      },
      present: { type: "array", items: { type: "string" }, description: "Frame ids in presenting order." },
      transition: { enum: ["fade", "cut"] },
      connectors: { enum: [...CONNECTORS], description: "How links are drawn unless a link says otherwise." },
      shapes: { type: "array", items: shape },
      markup: { type: "object", additionalProperties: strokes },
      layout: { type: "object", description: "Written by the editor: x/y pin a node in place (frame coordinates); dx/dy nudge an unpinned one; w/h size it.", additionalProperties: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, dx: { type: "number" }, dy: { type: "number" }, w: { type: "number" }, h: { type: "number" } } } },
      canvas: { type: "object", additionalProperties: point },
    },
  };
}
