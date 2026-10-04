/**
 * Does the board read on its own? `validate` checks that a board is well formed; this checks that someone opening
 * it cold can tell what it's saying: the answer up front, a description on every frame, a reading order, notes
 * grouped by what they are, an ending that says what's needed, and plain words throughout. Nudges, not errors:
 * a brainstorm wall can ignore them.
 */
import { plainIssues } from "../vendor/sketch/plain";
import { plainText } from "../vendor/sketch/rich";
import { homeFrame, layoutBoard } from "./layout";
import { frameDescription, isNote, typeOf, type FlowchartFile } from "./types";

export interface Note {
  /** "board", or "frames.<id>", or "nodes.<id>" */
  where: string;
  message: string;
  fix: string;
}

/** Frame titles that name a topic instead of saying something. */
const TOPIC = /^(the |our |some |open |key |main |next |my )?(ask|asks|request|brief|context|background|overview|summary|intro|problem|problems|options?|directions?|ideas?|notes?|thoughts?|research|findings?|evidence|data|insights?|flows?|happy path|journey|questions?|risks?|assumptions?|unknowns?|steps?|plan|todo|misc|other|parking lot|what (actually |really )?happens|what the research says|the ask,? as a flow)( for the pm| for the team| to test)?$/i;
const NEEDS = /\b(need|decide|decision|choose|pick|next|before|first|ask|find out|settle|would|should|recommend|try|test|do)\b|\?/i;

export function critique(doc: FlowchartFile): Note[] {
  const out: Note[] = [];
  const frames = doc.frames ?? {};
  const fids = Object.keys(frames);
  const title = (f: string) => plainText(frames[f]?.title ?? f).trim();
  const lead = (f: string) => frameDescription(frames[f]);
  const present = (Array.isArray(doc.present) ? doc.present : []).filter((f) => frames[f]);
  const order = present.length ? present : fids;
  const members: Record<string, string[]> = Object.fromEntries(fids.map((f) => [f, []]));
  for (const id of Object.keys(doc.nodes ?? {})) members[homeFrame(doc, id)]?.push(id);
  const linked = new Set((doc.links ?? []).flatMap((l) => [l.from, l.to]));

  if (fids.length < 2) {
    if (Object.keys(doc.nodes ?? {}).length > 12) out.push({ where: "board", message: "Everything is in one place, so there's no order to read it in.", fix: "Split it into 3 to 5 frames, one point each, and list them in \"present\"." });
    return out;
  }

  // a reading order
  const missing = fids.filter((f) => !present.includes(f));
  if (!present.length) out.push({ where: "board", message: "There's no reading order: nothing says which frame comes first.", fix: `Set "present" to the frames in the order of the argument, e.g. ${JSON.stringify(fids)}. They get numbered on the canvas.` });
  else if (missing.length) out.push({ where: "board", message: `${missing.map((f) => `"${title(f)}"`).join(" and ")} ${missing.length === 1 ? "isn't" : "aren't"} in the reading order.`, fix: "Add it to \"present\" where it belongs, or fold it into another frame." });
  if (fids.length > 7) out.push({ where: "board", message: `${fids.length} frames is a lot to hold in your head.`, fix: "Merge the ones that make the same point; five is plenty for one argument." });

  // a strip of frames never fits on a screen
  if (fids.length >= 4 && !Object.keys(doc.canvas ?? {}).length) {
    const b = layoutBoard(doc).bounds;
    if (b.w > b.h * 3.5) out.push({ where: "board", message: `The frames run in one long strip (${Math.round(b.w / b.h)} times wider than it's tall), so the board never fits on a screen.`, fix: `Wrap them into rows of two or three, like a comic: give ${JSON.stringify(title(order[Math.min(3, order.length - 1)]))} "near": ["below", "${order[0]}"] and carry on to the right of it. The numbers keep the order clear.` });
  }

  // the answer, up front
  const first = order[0];
  const asks = /\?\s*$/.test(plainText(doc.title ?? "")) || /\?\s*$/.test(title(first));
  if (!lead(first)) out.push({ where: `frames.${first}`, message: asks ? "The board asks a question and never answers it." : "The board doesn't say its point up front.", fix: "Give the first frame a \"description\" that answers it in a sentence or two, the way you'd say it out loud (\"Probably not. People don't mind late returns. They stop lending when tools come back broken.\"). Everything after it backs that up." });

  for (const f of order) {
    const p = `frames.${f}`;
    const ids = members[f] ?? [];
    // a point per frame
    if (!lead(f) && f !== first) {
      const topic = TOPIC.test(title(f)) || title(f).split(/\s+/).length < 3;
      out.push({ where: p, message: topic ? `"${title(f)}" names a topic, and nothing says what the frame shows.` : `"${title(f)}" doesn't say what to take from it.`, fix: `Add a "description": what this frame shows, in a plain sentence or two.${topic ? " And give it a title that says something (\"People don't mind late returns\"), not a topic." : ""}` });
    } else if (lead(f) && TOPIC.test(title(f))) {
      out.push({ where: p, message: `"${title(f)}" names a topic. It doesn't say anything yet.`, fix: "Give it a title that says what the frame shows, as a short plain sentence, so the titles alone tell the story." });
    }

    // notes grouped by what they are, not piled
    const loose = ids.filter((id) => !linked.has(id) && !(isNote(doc.nodes[id]) && doc.nodes[id].near));
    const stickies = loose.filter((id) => typeOf(doc.nodes[id]) === "sticky");
    const headings = loose.filter((id) => typeOf(doc.nodes[id]) === "text");
    const colors = new Set(stickies.map((id) => doc.nodes[id].color ?? "yellow"));
    if (!headings.length && stickies.length >= 6) out.push({ where: p, message: `${stickies.length} stickies of equal weight in a pile: nothing says which matter or how they group.`, fix: "Group them under 2 to 4 short text headings (a text followed by its stickies becomes a column), and cut the ones that don't earn a place." });
    else if (!headings.length && stickies.length >= 4 && colors.size >= 3) out.push({ where: p, message: "Different kinds of notes (what was found, what's assumed, what's still open) are mixed together.", fix: "Give each kind a text heading and put its stickies after it, so they read as columns." });
    if (ids.length > 16) out.push({ where: p, message: `${ids.length} things in one frame.`, fix: "Split it: one point per frame, 5 to 15 things each." });
  }

  // plain words: titles, descriptions and notes should read like a person talking
  const plain = (where: string, what: string, text: string | undefined, kind: Parameters<typeof plainIssues>[1]) => {
    const issues = plainIssues(text ?? "", kind);
    if (issues.length) out.push({ where, message: `${what} doesn't read like a person talking: "${plainText(text ?? "").slice(0, 70)}${plainText(text ?? "").length > 70 ? "…" : ""}"`, fix: `${issues.join(" ")} Write it the way you'd say it to a teammate.` });
  };
  plain("board", "The board's title", doc.title, "title");
  for (const f of order) {
    plain(`frames.${f}`, "This frame's title", frames[f]?.title, "title");
    plain(`frames.${f}`, "This frame's description", lead(f), "description");
  }
  for (const [id, n] of Object.entries(doc.nodes ?? {})) if (n?.text && typeOf(n) !== "stamp") plain(`nodes.${id}`, typeOf(n) === "sticky" ? "This sticky" : typeOf(n) === "text" ? "This text" : "This step", n.text, "note");

  // stickies that are really paragraphs
  for (const [id, n] of Object.entries(doc.nodes ?? {})) {
    if (typeOf(n) === "sticky" && plainText(n.text ?? "").length > 170) out.push({ where: `nodes.${id}`, message: "A sticky this long won't get read.", fix: "Keep the point (a dozen words) and move the detail to the frame's notes, or split it in two." });
  }

  // an ending that says what's needed
  const last = order[order.length - 1];
  const ending = [title(last), lead(last), ...(members[last] ?? []).map((id) => plainText(doc.nodes[id].text ?? ""))].join(" ");
  const pink = (members[last] ?? []).some((id) => doc.nodes[id].color === "pink");
  if (order.length > 2 && !pink && !NEEDS.test(ending)) out.push({ where: `frames.${last}`, message: "The board doesn't end on what happens next.", fix: "Close with a frame for what you'd do, what you need decided, or the questions still open (pink stickies)." });

  return out;
}

export function formatCritique(notes: Note[], file: string): string {
  if (!notes.length) return `✓ ${file} reads on its own: the answer up front, a description on every frame, an order to read them in, and plain words.`;
  return [`${notes.length} thing${notes.length === 1 ? "" : "s"} would make ${file} easier to read cold:`, ...notes.map((n) => `! ${n.where}: ${n.message}\n    → ${n.fix}`)].join("\n");
}
