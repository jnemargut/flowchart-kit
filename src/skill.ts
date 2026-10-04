import { FRAME_PROPS, LINK_PROPS, NODE_PROPS, NODE_TYPES, STAMPS, STICKY } from "./vocab";
import { plainWordsMd } from "../vendor/sketch/plain";

/** Shorthand used throughout the docs for "run this skill's bundled script". Defined at the top of SKILL.md. */
export const CLI = "fc";

export const SKILL_MD = `---
name: flowchart
description: Build low-fi, marker-style flowcharts, sticky-note boards and an infinite canvas (frames, steps, decisions, stickies, stamps, links, rough charts, and cards showing storyboards or wireframes) as a flowchart.json file, validate it, and open the canvas editor. Use when the user asks for a flowchart, a user flow, a journey or process map, a sticky-note board, a brainstorm, branching paths of storyboards or wireframes, or one board to think through or present a product idea.
---

# Flowcharts and a canvas, built by your agent

You turn a designer's loose thinking ("map what happens when an order runs late, and put the storyboard panel
next to where trust breaks") into a \`*.flowchart.json\` board: frames holding flows of steps and decisions,
stickies, stamps, links, and cards that show storyboards or wireframes. The tool lays the flows out for you,
validates the file, and opens a canvas where the designer drags things around, adds more, and presents it.
Everything is drawn in a hand-drawn marker style, so it reads as thinking, not as a final design.

## Running the tool

Everything runs through one bundled script in this skill's folder (it needs Node.js 18+ and nothing else):

\`\`\`bash
node "\${CLAUDE_SKILL_DIR}/scripts/flowchart.mjs" <command>
\`\`\`

\`\${CLAUDE_SKILL_DIR}\` is the folder this SKILL.md is in. If your agent doesn't fill it in, use that folder's
path. **Below, \`${CLI}\` is short for that whole command.**

## Workflow

1. **Know the vocabulary. Don't guess.** \`${CLI} vocab\` lists node types, sticky colors, stamps, and frame and
   link properties. Full list: [references/vocabulary.md](references/vocabulary.md).
2. **Look for cards nearby.** \`${CLI} cards\` lists the storyboards and wireframes in the folder with their panel
   and screen ids, so you can put the real thing on the board instead of describing it.
3. **Write the file**: \`<name>.flowchart.json\` (\`${CLI} new <file>\` makes a starter). Shape:
   [references/format.md](references/format.md). Worked example: [references/example.md](references/example.md).
4. **Validate and fix** until clean: \`${CLI} validate <file>\`. Errors say exactly what to change ("did you mean …").
   Warnings catch real problems (a decision with one way out, unlabeled answers, steps that should be stickies).
5. **Check it reads on its own**: \`${CLI} critique <file>\`. It tells you when a board is a pile of thoughts
   instead of an argument: no answer up front, frames that name a topic, stickies of equal weight in a heap.
   Fix what it finds (a brainstorm wall can ignore it).
6. **Look at what you made.** \`${CLI} render <file>\` writes \`<name>.png\` (\`<file>#<frame id>\` renders one
   frame, for a closer look). Read it and fix anything crowded or confusing before you say you're done.
7. **Open the editor** in the background (it keeps running): \`${CLI} dev <file>\`. Tell the designer the URL.
   Their tweaks save into the same file in real time.
8. **Iterate on the same file.** Re-read it before each edit, because the designer may have changed things.
   Their touches are theirs: \`layout\` (nudges and sizes), \`canvas\` (where frames sit), \`shapes\` (their
   drawings, on the board or in a frame) and \`markup\` (Play-mode sharpie). Keep them unless asked. You can read
   them, though: a red circle or a scribbled word is often feedback for you.
9. **Present**: frames are slides, in \`present\` order. \`${CLI} export <file> --pdf\` (board plus a page per frame)
   or \`--pptx\` (a slide per frame, with each frame's \`notes\` as speaker notes).

${plainWordsMd("frame titles and descriptions, steps, stickies, labels on arrows, speaker notes")}
## Craft: what makes a board useful

**A board should make sense to someone who wasn't there.** They open it, they know what it's saying in ten
seconds, and the rest backs that up. A pile of notes doesn't do that. So:

- **Say the answer first.** The first frame's \`description\` says what you found: "Probably not. People don't
  mind late returns. They stop lending when tools come back broken." If the board's title is a question, this is
  where it gets answered.
- **Every frame has a title that says something, and a description.** \`description\` is a plain sentence or two
  under the title: what this frame shows. The title is a short sentence too ("People don't mind late returns"),
  not a topic ("Research"). Someone reading only the titles should get the whole story.
- **Give it a reading order.** List the frames in \`present\` in the order you'd tell it. They get numbered on the
  canvas. Place them in rows of two or three with \`near\`, like a comic, so the board fits on a screen: a row
  left to right, then the next row \`"near": ["below", "<the first frame>"]\`.
- **Put notes in groups, under headings.** Loose notes are laid out in the order you write them. A short \`text\`
  followed by stickies becomes a column with the text as its heading. So write a heading, its notes, the next
  heading, its notes. Two to four columns a frame. Keep what you found, what you're guessing and what's still
  open in separate columns. Never leave six stickies in a pile.
- **Put a note about a step next to that step.** \`near\` ties a sticky to its step with a dotted line. Without it
  nobody can tell what the note is about.
- **End with what happens next**: what you'd do, what someone has to decide, or the questions still open.
- **Less.** A dozen words a sticky, 5 to 15 things a frame (not counting headings and stamps), five frames or
  so. Cut anything that isn't needed.

- **Frames are the unit.** Group a board into frames by story beat (how it should go, what really happens,
  what to try, what's still open), each named for its point. Each becomes a slide. Place new ones by relation, never coordinates:
  \`"near": ["right of", "happy"]\`, and the canvas finds the nearest free spot.
- **Never write coordinates.** Flows lay themselves out (left to right, or \`"dir": "down"\`). You say what's
  connected; the layout does the rest, and the designer's drags are kept on top.
- **Steps are short.** A few words, verb first: "Checks the app", "Asks the barista". Anything longer is a
  sticky beside it (\`"near": "<step id>"\`).
- **Decisions have answers.** A \`diamond\` gets a labeled link for each answer ("yes", "no", "after 10 min").
- **Show the unhappy path.** The flow people actually take (waiting, asking a human, giving up) is where the
  insight is. Give it its own frame.
- **Teal means the product.** \`"product": true\` marks the steps where the product shows up; the rest is the
  person's own world. Like in a storyboard, the contrast is the point.
- **Stickies carry the thinking.** Pink for questions and worries, blue for ideas, green for what works, gray
  for parked or assumed, yellow for everything else (what you found).
- **Stamps point at things.** A \`cursor\` on a wireframe card shows the tap, a \`star\` marks the best idea, a
  \`frown\` marks where it hurts: \`{ "type": "stamp", "icon": "cursor", "near": "status", "at": [0.5, 0.8] }\`.
- **Numbers, roughly.** When a number makes the point ("most people drop off at the cart", "8 of 12 asked
  about the ETA"), put a \`chart\` beside it: \`{ "type": "chart", "kind": "funnel", "text": "Where people drop off",
  "data": [["Browse", 1200], ["Cart", 640], ["Paid", 210]], "highlight": "Cart" }\`. Kinds: bar, hbar (long
  labels), line (over time), funnel, pie, donut (parts of a whole, a few slices). Do the math yourself first
  (with code if there's a file); the chart shows the two or three numbers that matter, not the whole sheet.
  \`highlight\` the one thing to look at and put the takeaway on a sticky next to it.
- **Link out.** A ticket, a doc or a prototype is a \`link\` card (\`"url"\`), or a \`url\` on any step or frame.
- **Show, don't describe.** If a storyboard panel or a wireframe screen exists for a moment, put it on the board
  as a \`card\` and link to it from the step (\`"style": "dashed"\` reads as "see this").
- **Speaker notes.** A frame's \`notes\` say what to point out when it's on screen.
- **Emphasis is fine, sparingly.** Any text can use \`**bold**\`, \`*italic*\`, \`__underline__\` and
  \`~~struck out~~\` (designers get Cmd+B, Cmd+I and Cmd+U in the editor). Bold the one word that matters,
  strike what changed.
- **Looks are optional.** Boxes take \`size\` (s, m, l, xl), \`fill\`, \`stroke\` and \`weight\`; arrows take
  \`shape\` (curved, angled, straight), \`style\` (solid, dashed, dotted), \`head\` (end, start, both, none),
  \`color\` and \`weight\`. Use them to mean something (red for where it breaks), not to decorate.
`;

const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `- \`${k}\`: ${v}`).join("\n");

export function vocabularyMd(): string {
  return [
    "# Flowchart vocabulary", "", `Generated from the tool. Query live with \`${CLI} vocab\`.`, "",
    "## Node types", "", ...Object.values(NODE_TYPES).flatMap((d) => [`### \`${d.type}\`: ${d.label}`, "", d.doc, "", "```json", JSON.stringify(d.example), "```", ""]),
    "## Node properties", "", list(NODE_PROPS), "",
    "## Sticky colors", "", list(Object.fromEntries(Object.entries(STICKY).map(([k, v]) => [k, v.doc]))), "",
    "## Stamps", "", list(STAMPS), "",
    "## Frame properties", "", list(FRAME_PROPS), "",
    "## Link properties", "", list(LINK_PROPS), "",
  ].join("\n");
}

export const FORMAT_MD = `# flowchart.json format

\`\`\`jsonc
{
  "title": "What happens when the order runs late",
  "frames": {                              // keyed by id; each one is a slide in Play
    "happy": { "title": "When the order is on time, it works",         // a short sentence, not a topic
               "description": "You order ahead, walk in, grab your drink and go.",   // what it shows, written large
               "notes": "What we designed for." },                     // speaker notes for Play
    "late": { "title": "When the order is late, people ask the barista", "description": "The app still says 4 minutes.",
              "near": ["right of", "happy"] },                         // placed by relation
    "ideas": { "title": "Three ideas to try", "description": "I'd start with the one that has a star.",
               "near": ["below", "late"], "url": "https://…/browse/ORDER-400" }
  },
  "nodes": {                               // keyed by id; every node goes in a frame (or none: the loose area)
    "leave": { "type": "pill", "text": "Leaves home", "frame": "happy" },
    "order": { "text": "Orders a latte ahead", "frame": "happy", "product": true },     // a box (the default)
    "ready": { "type": "diamond", "text": "Ready on time?", "frame": "happy" },
    "eta": { "type": "sticky", "text": "The app promises 4 minutes", "near": "order" }, // sits beside "order"
    "screen": { "type": "card", "ref": "./order-ahead.wireframe.json#status", "frame": "late" },
    "tap": { "type": "stamp", "icon": "cursor", "near": "screen", "at": [0.5, 0.36] },   // on top of the card
    "h-tell": { "type": "text", "text": "**Tell them**", "frame": "ideas" },            // a heading: the stickies after it
    "text-me": { "type": "sticky", "text": "Text me when it's ready", "color": "blue", "frame": "ideas" },   // stack under it
    "ticket": { "type": "link", "text": "ORDER-412: late order alerts", "url": "https://…/ORDER-412", "frame": "ideas" }
  },
  "links": [
    { "from": "leave", "to": "order" },
    { "from": "ready", "to": "wait", "label": "no" },        // links can cross frames
    { "from": "check", "to": "screen", "style": "dashed" }
  ],
  "present": ["happy", "late", "ideas"],    // slide order (default: as listed)
  "transition": "fade",                     // or "cut"

  "connectors": "curved",                 // or "angled" / "straight", for every link that doesn't say

  // written by the editor. Leave these alone:
  "layout": { "order": { "x": 210, "y": 64, "w": 200 }, "eta": { "dx": 12 } },  // pins (x/y), nudges, sizes
  "canvas": { "late": [980, 0] },                                       // where the designer put a frame
  "shapes": [{ "type": "line", "points": [[0, 180], [900, 180]], "color": "grey" }],  // drawings off-frame
  "markup": { "late": [{ "points": [[10, 10], [40, 30]] }] }             // Play-mode sharpie per frame
}
\`\`\`

**Looks** (all optional): boxes, pills, decisions and text take \`size\` (\`s\`, \`m\`, \`l\`, \`xl\`), \`fill\`
(\`white\`, \`paper\`, \`light\`, \`mid\`, \`dark\`, \`yellow\`, \`pink\`, \`blue\`, \`green\`, \`teal\`, \`none\`),
\`stroke\` (\`ink\`, \`grey\`, \`red\`, \`blue\`, \`green\`, \`orange\`, \`teal\`, \`none\`) and \`weight\` (\`thin\`,
\`normal\`, \`thick\`). White with no stroke covers things up. Links take \`shape\` (\`curved\`, \`angled\`,
\`straight\`), \`style\` (\`solid\`, \`dashed\`, \`dotted\`), \`head\` (\`end\`, \`start\`, \`both\`, \`none\`),
\`color\`, \`weight\`, and \`fromSide\`/\`toSide\` (\`left\`, \`right\`, \`top\`, \`bottom\`) to pin which sides they use.
Cards can be cropped: \`"crop": [left, top, right, bottom]\` as fractions of the picture.

**Nodes** take \`type\` (default \`box\`), \`text\`, \`frame\`, and per type: \`color\` (stickies), \`near\`
(stickies, text, stamps and link cards sit beside or on top of that node, in its frame), \`icon\` and \`at\` (stamps),
\`ref\` (cards), \`url\` (link cards, or a clickable badge on anything else) and \`product\` (teal).

**Staying put.** Once the designer edits a board by hand, the editor pins everything that's on it
(\`layout.<id>.x\`/\`y\`, and frames in \`canvas\`), so nothing reshuffles when something small changes. New nodes you
add land next to whatever they're linked to. Don't remove pins unless asked; the designer has a **Tidy up** button
for that.

**Layout** is automatic. Each frame's linked nodes become a flow, laid out left to right (\`"dir": "down"\` on
the frame for top to bottom). Unlinked things go under the flow and read like an outline, in the order they're
written: a \`text\` followed by stickies (or cards, charts, links) becomes a column headed by that text, columns sit
side by side, a large text (\`"size": "l"\` or \`"xl"\`) starts a new section across the frame, and stickies with no
heading line up in a grid. Notes with \`near\` go beside their node, tied to it with a dotted line; stamps go on top
of theirs. You never write coordinates.

**Frames** go where \`near\` says: \`"right of"\`, \`"left of"\`, \`"below"\` or \`"above"\` another frame,
in the nearest free spot. Without \`near\`, each goes to the right of the last. Once the designer drags one,
its spot is saved in \`canvas\`, and it stays put.

**Cards** show other kits' work, drawn by those kits:
- \`"./x.storyboard.json"\` the whole storyboard, \`"./x.storyboard.json#<panel id>"\` one panel (Storyboard Kit)
- \`"./x.wireframe.json"\` the whole flow, \`"./x.wireframe.json#<screen id>"\` one screen (Wireframe Kit)
- \`"./photo.jpg"\` any image (a photo, a screenshot, a whiteboard), sketchified in grays to match;
  \`"sketch": false\` shows it as it is. The designer can also drop, paste or upload images in the editor
  (they're saved to \`images/\` next to the board).

Each kit writes its picture next to its file (\`x.<panel>.png\`). When the file is newer and the kit is
installed, the picture is redrawn automatically; otherwise the last one shows, marked "out of date".
\`${CLI} cards <board>\` shows how each card is doing.

**Drawings** are the designer's: boxes, ovals, lines, arrows, freehand and free text, on the board
(\`"shapes"\`, canvas coordinates) or inside a frame (\`frames.<id>.shapes\`, frame coordinates, so they move
with it). Swimlanes are usually lines and text drawn in a frame.
`;

export function exampleMd(exampleJson: string): string {
  return `# Worked example

Prompt: *"Map what happens when a Corner Coffee order runs late. Use the late latte storyboard and the order
status screen, and park a few ideas."*

First, \`${CLI} cards\` finds \`late-latte.storyboard.json\` (panels: order-ahead, walking, in-line, checks-app,
later, asks, commute) and \`order-ahead.wireframe.json\` (screens: menu, drink, cart, status).

\`\`\`json
${exampleJson.trim()}
\`\`\`

Why it works: three frames tell the story in order (and become three slides), the happy path's decision has a
labeled way out for each answer, and "no" crosses into the late frame. The late frame shows the real thing:
the status screen with a cursor stamp on it, and the storyboard panel where Marcus asks a human. Steps are a few
words each; the thinking lives on stickies beside them. Teal marks where the product shows up, and there's no
teal where trust breaks. Ideas are a wall of stickies with a star on the favorite and a link to the ticket.
`;
}

/** Pointer for AGENTS.md, for agents that don't discover skills on their own. */
export const agentsBlock = (skillDir: string) => `<!-- flowchart:start -->
## Flowcharts and boards (flowchartkit skill)

For flowcharts, user flows, sticky-note boards, or one canvas holding storyboards and wireframes, read
\`${skillDir}/SKILL.md\` and follow it. \`${CLI}\` there means: \`node ${skillDir}/scripts/flowchart.mjs\`.

- \`${CLI} vocab\` lists node types, sticky colors and stamps; \`${CLI} cards\` lists storyboards and wireframes nearby.
- Write \`<name>.flowchart.json\`, then run \`${CLI} validate <file>\` and fix every error.
- \`${CLI} dev <file>\` opens the canvas editor (run it in the background). The designer's edits save into the
  same file: re-read before editing, and keep \`layout\`, \`canvas\`, \`shapes\` and \`markup\`.
- \`${CLI} render <file>\` draws the board; \`${CLI} export <file> --pdf|--pptx\` makes a deck, one slide per frame.

To think a request or a problem through with storyboards, wireframes and a board together (for example "the PM
wants X, here are the Jiras"), read \`${skillDir.replace(/flowchart$/, "low-fi-think")}/SKILL.md\` and follow it.
<!-- flowchart:end -->
`;
