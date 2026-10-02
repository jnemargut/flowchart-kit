/** Checks a flowchart file. Errors say exactly what to change; warnings are nudges toward a clearer board. */
import { formatIssues, suggest, type Issue, type Result } from "../vendor/sketch/suggest";
import { parseRef } from "./refs";
import { layoutBoard } from "./layout";
import { isNote, typeOf, type FlowchartFile } from "./types";
import { NODE_TYPES, SIDES, STAMP_NAMES, STICKY_COLORS, TYPES } from "./vocab";

export type { Result };

const NODE_KEYS = ["type", "text", "frame", "color", "near", "icon", "at", "ref", "url", "sketch", "product"];
const FRAME_KEYS = ["title", "near", "dir", "notes", "url", "shapes", "size"];
const okUrl = (u: unknown) => typeof u === "string" && /^(https?:\/\/|mailto:|figma:|file:|\.{0,2}\/)\S+$/i.test(u.trim());
const LINK_KEYS = ["from", "to", "label", "style"];
const TOP_KEYS = ["$schema", "title", "frames", "nodes", "links", "present", "transition", "shapes", "markup", "layout", "canvas"];

export function validate(doc: FlowchartFile): Result {
  const errors: Issue[] = [], warnings: Issue[] = [];
  const err = (path: string, message: string, hint?: string) => errors.push({ path, message, hint });
  const warn = (path: string, message: string, hint?: string) => warnings.push({ path, message, hint });
  const unknownKeys = (o: object, allowed: string[], path: string) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) { const s = suggest(k, allowed); err(`${path}.${k}`, `"${k}" isn't a property here.`, s ? `Did you mean "${s}"?` : `Allowed: ${allowed.join(", ")}`); }
  };

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, errors: [{ path: "(file)", message: "The file should be a JSON object.", hint: "Start from `fc new <file>`." }], warnings };
  unknownKeys(doc, TOP_KEYS, "(file)");
  if (typeof doc.title !== "string" || !doc.title.trim()) err("title", "Every board needs a title.", 'Add "title": "What happens when the order runs late".');
  if (!doc.nodes || typeof doc.nodes !== "object" || Array.isArray(doc.nodes)) { err("nodes", '"nodes" should be an object keyed by id.', 'e.g. "nodes": { "open": { "type": "pill", "text": "Opens the app" } }'); return { ok: false, errors, warnings }; }

  const frames = doc.frames ?? {};
  const frameIds = Object.keys(frames);
  const ids = Object.keys(doc.nodes);
  if (doc.frames !== undefined && (typeof doc.frames !== "object" || Array.isArray(doc.frames))) err("frames", '"frames" should be an object keyed by id.');

  for (const [fid, f] of Object.entries(frames)) {
    const p = `frames.${fid}`;
    if (!f || typeof f !== "object") { err(p, "A frame should be an object.", '{ "title": "Happy path" }'); continue; }
    unknownKeys(f, FRAME_KEYS, p);
    if (fid.includes("#") || !fid.trim()) err(p, "Frame ids can't be empty or contain #.");
    if (f.near !== undefined) {
      if (!Array.isArray(f.near) || f.near.length !== 2) err(`${p}.near`, '"near" is a pair: [side, frame id].', `e.g. "near": ["right of", "${frameIds.find((x) => x !== fid) ?? "happy"}"]`);
      else {
        if (!SIDES.includes(f.near[0])) { const s = suggest(String(f.near[0]), SIDES); err(`${p}.near[0]`, `"${f.near[0]}" isn't a side.`, s ? `Did you mean "${s}"?` : `Use ${SIDES.map((x) => `"${x}"`).join(", ")}.`); }
        if (f.near[1] === fid) err(`${p}.near[1]`, "A frame can't be placed next to itself.");
        else if (!frames[f.near[1]]) { const s = suggest(String(f.near[1]), frameIds); err(`${p}.near[1]`, `There's no frame "${f.near[1]}".`, s ? `Did you mean "${s}"?` : `Frames: ${frameIds.join(", ")}`); }
      }
    }
    if (f.url !== undefined && !okUrl(f.url)) err(`${p}.url`, `"${f.url}" doesn't look like a web address.`, 'Start it with https://, e.g. "https://www.figma.com/proto/…"');
    if (f.dir !== undefined && f.dir !== "right" && f.dir !== "down") err(`${p}.dir`, `"dir" is "right" or "down".`);
  }

  for (const [id, n] of Object.entries(doc.nodes)) {
    const p = `nodes.${id}`;
    if (!n || typeof n !== "object" || Array.isArray(n)) { err(p, "A node should be an object.", '{ "text": "Orders ahead" }'); continue; }
    unknownKeys(n, NODE_KEYS, p);
    if (id.includes("#") || !id.trim()) err(p, "Node ids can't be empty or contain #.");
    if (n.type !== undefined && !TYPES.includes(n.type)) { const s = suggest(String(n.type), TYPES); err(`${p}.type`, `"${n.type}" isn't a node type.`, s ? `Did you mean "${s}"?` : `Types: ${TYPES.join(", ")}. Anything else can be a box, a sticky or a drawing.`); continue; }
    const t = typeOf(n);
    if (n.frame !== undefined && !frames[n.frame]) { const s = suggest(n.frame, frameIds); err(`${p}.frame`, `There's no frame "${n.frame}".`, s ? `Did you mean "${s}"?` : frameIds.length ? `Frames: ${frameIds.join(", ")}` : `Add it to "frames", or leave "frame" out.`); }
    if (n.color !== undefined) {
      if (t !== "sticky") warn(`${p}.color`, `"color" only applies to stickies.`, "Leave it out, or make it a sticky.");
      else if (!STICKY_COLORS.includes(n.color)) { const s = suggest(String(n.color), STICKY_COLORS); err(`${p}.color`, `"${n.color}" isn't a sticky color.`, s ? `Did you mean "${s}"?` : `Colors: ${STICKY_COLORS.join(", ")}`); }
    }
    if (n.near !== undefined) {
      if (!isNote(n)) warn(`${p}.near`, `"near" only applies to stickies, text and stamps.`, "Link it with \"links\" instead.");
      else if (n.near === id) err(`${p}.near`, "A node can't sit near itself.");
      else if (!doc.nodes[n.near]) { const s = suggest(n.near, ids); err(`${p}.near`, `There's no node "${n.near}".`, s ? `Did you mean "${s}"?` : undefined); }
    }
    if (t === "stamp") {
      if (!n.icon) err(`${p}.icon`, "A stamp needs an icon.", `Icons: ${STAMP_NAMES.join(", ")}`);
      else if (!STAMP_NAMES.includes(n.icon)) { const s = suggest(n.icon, STAMP_NAMES); err(`${p}.icon`, `"${n.icon}" isn't a stamp.`, s ? `Did you mean "${s}"?` : `Icons: ${STAMP_NAMES.join(", ")}`); }
      if (n.at !== undefined && (!Array.isArray(n.at) || n.at.length !== 2 || n.at.some((v) => typeof v !== "number"))) err(`${p}.at`, '"at" is two fractions: [x, y].', 'e.g. "at": [0.5, 0.8] for the middle, near the bottom.');
      else if (n.at && !n.near) warn(`${p}.at`, '"at" places a stamp on the node in "near".', "Add near, or leave at out.");
    } else {
      if (n.icon !== undefined) warn(`${p}.icon`, `"icon" only applies to stamps.`);
      if (n.at !== undefined) warn(`${p}.at`, `"at" only applies to stamps.`);
    }
    if (t === "card") {
      if (!n.ref) err(`${p}.ref`, "A card needs a ref: the file it shows.", 'e.g. "ref": "./late-latte.storyboard.json#in-line"');
      else if (!parseRef(n.ref).kind) err(`${p}.ref`, `Cards show storyboards, wireframes or images, not "${n.ref}".`, 'Point at "x.storyboard.json", "x.storyboard.json#panel", "x.wireframe.json#screen" or an image.');
    } else if (n.ref !== undefined) warn(`${p}.ref`, `"ref" only applies to cards.`, 'Add "type": "card".');
    if (["box", "pill", "diamond", "sticky", "text"].includes(t) && !(n.text ?? "").trim()) warn(`${p}.text`, `This ${NODE_TYPES[t].label.toLowerCase()} has no words.`);
    if (["box", "pill", "diamond"].includes(t) && (n.text ?? "").length > 70) warn(`${p}.text`, "That's long for a step. Keep steps to a few words and put the rest on a sticky beside it.", `Add { "type": "sticky", "near": "${id}", "text": "…" }.`);
    if (n.url !== undefined && !okUrl(n.url)) err(`${p}.url`, `"${n.url}" doesn't look like a web address.`, 'Start it with https://, e.g. "https://example.atlassian.net/browse/ORDER-412"');
    if (t === "link" && !n.url) err(`${p}.url`, "A link card needs a url.", '"url": "https://…"');
    if (n.sketch !== undefined && (t !== "card" || !n.ref || parseRef(n.ref).kind !== "image")) warn(`${p}.sketch`, `"sketch" only applies to image cards.`);
    if (n.product !== undefined && typeof n.product !== "boolean") err(`${p}.product`, '"product" is true or false.');
  }

  const seen = new Set<string>();
  if (doc.links !== undefined && !Array.isArray(doc.links)) err("links", '"links" should be a list.', '[{ "from": "open", "to": "pick" }]');
  (Array.isArray(doc.links) ? doc.links : []).forEach((l, i) => {
    const p = `links[${i}]`;
    if (!l || typeof l !== "object") { err(p, "A link should be an object.", '{ "from": "a", "to": "b" }'); return; }
    unknownKeys(l, LINK_KEYS, p);
    for (const end of ["from", "to"] as const) {
      if (!l[end]) err(`${p}.${end}`, `A link needs "${end}".`);
      else if (!doc.nodes[l[end]]) { const s = suggest(l[end], ids); err(`${p}.${end}`, `There's no node "${l[end]}".`, s ? `Did you mean "${s}"?` : undefined); }
    }
    if (l.from && l.from === l.to) warn(p, "This link goes from a node to itself.");
    if (l.style !== undefined && l.style !== "solid" && l.style !== "dashed") err(`${p}.style`, '"style" is "solid" or "dashed".');
    const k = `${l.from}→${l.to}`;
    if (seen.has(k)) warn(p, `There are two links from "${l.from}" to "${l.to}".`, "Merge them, or label each one.");
    seen.add(k);
    const a = doc.nodes[l.from];
    if (a && typeOf(a) === "stamp") warn(p, "Stamps don't usually link anywhere.", "Link the node it sits on instead.");
  });

  // decisions want two ways out, each labeled
  for (const [id, n] of Object.entries(doc.nodes)) {
    if (!n || typeOf(n) !== "diamond") continue;
    const out = (doc.links ?? []).filter((l) => l?.from === id);
    if (out.length < 2) warn(`nodes.${id}`, `The decision "${n.text ?? id}" has ${out.length ? "only one way" : "no way"} out.`, 'Add a link for each answer, labeled ("yes", "no").');
    else if (out.some((l) => !l.label)) warn(`nodes.${id}`, `Label every link leaving the decision "${n.text ?? id}".`, 'e.g. { "from": "' + id + '", "to": "…", "label": "no" }');
  }

  if (doc.present !== undefined) {
    if (!Array.isArray(doc.present)) err("present", '"present" is a list of frame ids, in order.');
    else doc.present.forEach((f, i) => { if (!frames[f]) { const s = suggest(String(f), frameIds); err(`present[${i}]`, `There's no frame "${f}".`, s ? `Did you mean "${s}"?` : `Frames: ${frameIds.join(", ")}`); } });
  }
  if (doc.transition !== undefined && doc.transition !== "fade" && doc.transition !== "cut") err("transition", '"transition" is "fade" or "cut".');

  // board-level nudges
  const counts: Record<string, number> = {};
  for (const n of Object.values(doc.nodes)) if (n?.frame && frames[n.frame]) counts[n.frame] = (counts[n.frame] ?? 0) + 1;
  for (const [f, c] of Object.entries(counts)) if (c > 30) warn(`frames.${f}`, `"${frames[f].title ?? f}" holds ${c} things. That's a lot for one slide.`, "Split it into two frames, one per part of the story.");
  if (!frameIds.length && ids.length > 14) warn("frames", `${ids.length} things and no frames.`, 'Group them into "frames" (happy path, what goes wrong, ideas): they become slides in Play.');

  if (!errors.length) {
    try {
      const L = layoutBoard(doc);
      const fs = Object.values(L.frames).filter((f) => !f.loose);
      for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
        const a = fs[i], b = fs[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) warn(`frames.${b.id}`, `The frames "${a.title}" and "${b.title}" overlap.`, "Drag one of them in the editor, or remove its saved spot in \"canvas\".");
      }
    } catch (e) { err("(layout)", `Couldn't lay this out: ${(e as Error).message}`); }
  }
  return { ok: !errors.length, errors, warnings };
}

export function formatResult(r: Result, file: string, doc?: FlowchartFile): string {
  const summary = doc ? `${Object.keys(doc.frames ?? {}).length} frame(s), ${Object.keys(doc.nodes).length} node(s), ${(doc.links ?? []).length} link(s)` : undefined;
  return formatIssues(r, file, summary);
}
