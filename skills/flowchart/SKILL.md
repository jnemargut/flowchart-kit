---
name: flowchart
description: Build low-fi, marker-style flowcharts, sticky-note boards and an infinite canvas (frames, steps, decisions, stickies, stamps, links, and cards showing storyboards or wireframes) as a flowchart.json file, validate it, and open the canvas editor. Use when the user asks for a flowchart, a user flow, a journey or process map, a sticky-note board, a brainstorm, branching paths of storyboards or wireframes, or one board to think through or present a product idea.
---

# Flowcharts and a canvas, built by your agent

You turn a designer's loose thinking ("map what happens when an order runs late, and put the storyboard panel
next to where trust breaks") into a `*.flowchart.json` board: frames holding flows of steps and decisions,
stickies, stamps, links, and cards that show storyboards or wireframes. The tool lays the flows out for you,
validates the file, and opens a canvas where the designer drags things around, adds more, and presents it.
Everything is drawn in a hand-drawn marker style, so it reads as thinking, not as a final design.

## Running the tool

Everything runs through one bundled script in this skill's folder (it needs Node.js 18+ and nothing else):

```bash
node "${CLAUDE_SKILL_DIR}/scripts/flowchart.mjs" <command>
```

`${CLAUDE_SKILL_DIR}` is the folder this SKILL.md is in. If your agent doesn't fill it in, use that folder's
path. **Below, `fc` is short for that whole command.**

## Workflow

1. **Know the vocabulary. Don't guess.** `fc vocab` lists node types, sticky colors, stamps, and frame and
   link properties. Full list: [references/vocabulary.md](references/vocabulary.md).
2. **Look for cards nearby.** `fc cards` lists the storyboards and wireframes in the folder with their panel
   and screen ids, so you can put the real thing on the board instead of describing it.
3. **Write the file**: `<name>.flowchart.json` (`fc new <file>` makes a starter). Shape:
   [references/format.md](references/format.md). Worked example: [references/example.md](references/example.md).
4. **Validate and fix** until clean: `fc validate <file>`. Errors say exactly what to change ("did you mean …").
   Warnings catch real problems (a decision with one way out, unlabeled answers, steps that should be stickies).
5. **Open the editor** in the background (it keeps running): `fc dev <file>`. Tell the designer the URL.
   Their tweaks save into the same file in real time.
6. **Look at what you made.** `fc render <file>` writes `<name>.png`. Read it and fix anything crowded or
   confusing before you say you're done.
7. **Iterate on the same file.** Re-read it before each edit, because the designer may have changed things.
   Their touches are theirs: `layout` (nudges and sizes), `canvas` (where frames sit), `shapes` (their
   drawings, on the board or in a frame) and `markup` (Play-mode sharpie). Keep them unless asked. You can read
   them, though: a red circle or a scribbled word is often feedback for you.
8. **Present**: frames are slides, in `present` order. `fc export <file> --pdf` (board plus a page per frame)
   or `--pptx` (a slide per frame, with each frame's `notes` as speaker notes).

## Craft: what makes a board useful

- **Frames are the unit.** Group a board into frames by story beat: "Happy path", "When it runs late",
  "Ideas", "Open questions". Each becomes a slide. Place new ones by relation, never coordinates:
  `"near": ["right of", "happy"]`, and the canvas finds the nearest free spot.
- **Never write coordinates.** Flows lay themselves out (left to right, or `"dir": "down"`). You say what's
  connected; the layout does the rest, and the designer's drags are kept on top.
- **Steps are short.** A few words, verb first: "Checks the app", "Asks the barista". Anything longer is a
  sticky beside it (`"near": "<step id>"`).
- **Decisions have answers.** A `diamond` gets a labeled link for each answer ("yes", "no", "after 10 min").
- **Show the unhappy path.** The flow people actually take (waiting, asking a human, giving up) is where the
  insight is. Give it its own frame.
- **Teal means the product.** `"product": true` marks the steps where the product shows up; the rest is the
  person's own world. Like in a storyboard, the contrast is the point.
- **Stickies carry the thinking.** Pink for questions and worries, blue for ideas, green for what works, gray
  for parked, yellow for everything else.
- **Stamps point at things.** A `cursor` on a wireframe card shows the tap, a `star` marks the best idea, a
  `frown` marks where it hurts: `{ "type": "stamp", "icon": "cursor", "near": "status", "at": [0.5, 0.8] }`.
- **Link out.** A ticket, a doc or a prototype is a `link` card (`"url"`), or a `url` on any step or frame.
- **Show, don't describe.** If a storyboard panel or a wireframe screen exists for a moment, put it on the board
  as a `card` and link to it from the step (`"style": "dashed"` reads as "see this").
- **Speaker notes.** A frame's `notes` say what to point out when it's on screen.
- **Emphasis is fine, sparingly.** Any text can use `**bold**`, `*italic*` and `~~struck out~~`
  (designers get Cmd+B and Cmd+I in the editor). Bold the one word that matters, strike what changed.
- 5 to 15 things per frame. Split bigger ones.
