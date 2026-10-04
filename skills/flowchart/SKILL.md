---
name: flowchart
description: Build low-fi, marker-style flowcharts, sticky-note boards and an infinite canvas (frames, steps, decisions, stickies, stamps, links, rough charts, and cards showing storyboards or wireframes) as a flowchart.json file, validate it, and open the canvas editor. Use when the user asks for a flowchart, a user flow, a journey or process map, a sticky-note board, a brainstorm, branching paths of storyboards or wireframes, or one board to think through or present a product idea.
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
5. **Check it reads on its own**: `fc critique <file>`. It tells you when a board is a pile of thoughts
   instead of an argument: no answer up front, frames that name a topic, stickies of equal weight in a heap.
   Fix what it finds (a brainstorm wall can ignore it).
6. **Look at what you made.** `fc render <file>` writes `<name>.png` (`<file>#<frame id>` renders one
   frame, for a closer look). Read it and fix anything crowded or confusing before you say you're done.
7. **Open the editor** in the background (it keeps running): `fc dev <file>`. Tell the designer the URL.
   Their tweaks save into the same file in real time.
8. **Iterate on the same file.** Re-read it before each edit, because the designer may have changed things.
   Their touches are theirs: `layout` (nudges and sizes), `canvas` (where frames sit), `shapes` (their
   drawings, on the board or in a frame) and `markup` (Play-mode sharpie). Keep them unless asked. You can read
   them, though: a red circle or a scribbled word is often feedback for you.
9. **Present**: frames are slides, in `present` order. `fc export <file> --pdf` (board plus a page per frame)
   or `--pptx` (a slide per frame, with each frame's `notes` as speaker notes).

## Write it plainly

Everything you write here (frame titles and descriptions, steps, stickies, labels on arrows, speaker notes) should sound like you telling a teammate across the table. If it sounds
like a headline, a slogan or a slide from a consultant, write it again.

- **Whole sentences, ordinary words.** Say who does what. "People don't mind when a tool comes back a day late."
  Not "Owners shrug at late."
- **One idea in a sentence.** No semicolons. No colon bolting two ideas together. If there are two things to say,
  write two short sentences.
- **Keep the small words** (the, a, their, when, because, so). Leaving them out is what makes writing read like a
  telegram.
- **Say the thing, don't name it.** "We don't know how often tools come back late" is clearer than "The claim has
  no number behind it."
- **The plainest word wins.** "Use", not "leverage". "Show", not "surface". "Problem", not "pain point". "The
  hard part", not "friction". "Depends on", not "rests on" or "hinges on". "Because", not "due to".
- **No clever turns.** No metaphors, no slogans, no lists of three for rhythm. If a phrase is showing off, cut
  it.
- **Numbers and names as they are.** "8 of 12 people". "The Pay button". Not "most users" or "the primary action".
- **Short.** A title is one plain sentence you could say out loud, about ten words at most. A description is one
  or two short sentences. A sticky is a dozen words. A step in a flow is the one place for a clipped label: a
  few words, verb first ("Asks the barista").
- **Read it out loud.** If you wouldn't say it that way to a friend, change it until you would.

| Instead of | Write |
|---|---|
| Owners shrug at late; hidden damage is what stops them lending | People don't mind late returns. They stop lending when tools come back broken. |
| The ask rests on one claim with no number behind it | The PM says people return things late. We don't know how often. |
| The fee acts after the loan, and never looks at the tool | A late fee doesn't check whether the tool is broken. |
| Try first: check the tool at handover, let the app do the asking | A cheaper idea to try first |
| Late, nobody tells them, so they ask a human | When the order is late, people ask the barista |
| Trust lost | After this, he stops ordering ahead |
| Surface the real queue to reduce friction | Show people the real queue so they know how long it'll be |

The same goes for the message you send when you hand it over.

## Craft: what makes a board useful

**A board should make sense to someone who wasn't there.** They open it, they know what it's saying in ten
seconds, and the rest backs that up. A pile of notes doesn't do that. So:

- **Say the answer first.** The first frame's `description` says what you found: "Probably not. People don't
  mind late returns. They stop lending when tools come back broken." If the board's title is a question, this is
  where it gets answered.
- **Every frame has a title that says something, and a description.** `description` is a plain sentence or two
  under the title: what this frame shows. The title is a short sentence too ("People don't mind late returns"),
  not a topic ("Research"). Someone reading only the titles should get the whole story.
- **Give it a reading order.** List the frames in `present` in the order you'd tell it. They get numbered on the
  canvas. Place them in rows of two or three with `near`, like a comic, so the board fits on a screen: a row
  left to right, then the next row `"near": ["below", "<the first frame>"]`.
- **Put notes in groups, under headings.** Loose notes are laid out in the order you write them. A short `text`
  followed by stickies becomes a column with the text as its heading. So write a heading, its notes, the next
  heading, its notes. Two to four columns a frame. Keep what you found, what you're guessing and what's still
  open in separate columns. Never leave six stickies in a pile.
- **Put a note about a step next to that step.** `near` ties a sticky to its step with a dotted line. Without it
  nobody can tell what the note is about.
- **End with what happens next**: what you'd do, what someone has to decide, or the questions still open.
- **Less.** A dozen words a sticky, 5 to 15 things a frame (not counting headings and stamps), five frames or
  so. Cut anything that isn't needed.

- **Frames are the unit.** Group a board into frames by story beat (how it should go, what really happens,
  what to try, what's still open), each named for its point. Each becomes a slide. Place new ones by relation, never coordinates:
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
  for parked or assumed, yellow for everything else (what you found).
- **Stamps point at things.** A `cursor` on a wireframe card shows the tap, a `star` marks the best idea, a
  `frown` marks where it hurts: `{ "type": "stamp", "icon": "cursor", "near": "status", "at": [0.5, 0.8] }`.
- **Numbers, roughly.** When a number makes the point ("most people drop off at the cart", "8 of 12 asked
  about the ETA"), put a `chart` beside it: `{ "type": "chart", "kind": "funnel", "text": "Where people drop off",
  "data": [["Browse", 1200], ["Cart", 640], ["Paid", 210]], "highlight": "Cart" }`. Kinds: bar, hbar (long
  labels), line (over time), funnel, pie, donut (parts of a whole, a few slices). Do the math yourself first
  (with code if there's a file); the chart shows the two or three numbers that matter, not the whole sheet.
  `highlight` the one thing to look at and put the takeaway on a sticky next to it.
- **Link out.** A ticket, a doc or a prototype is a `link` card (`"url"`), or a `url` on any step or frame.
- **Show, don't describe.** If a storyboard panel or a wireframe screen exists for a moment, put it on the board
  as a `card` and link to it from the step (`"style": "dashed"` reads as "see this").
- **Speaker notes.** A frame's `notes` say what to point out when it's on screen.
- **Emphasis is fine, sparingly.** Any text can use `**bold**`, `*italic*`, `__underline__` and
  `~~struck out~~` (designers get Cmd+B, Cmd+I and Cmd+U in the editor). Bold the one word that matters,
  strike what changed.
- **Looks are optional.** Boxes take `size` (s, m, l, xl), `fill`, `stroke` and `weight`; arrows take
  `shape` (curved, angled, straight), `style` (solid, dashed, dotted), `head` (end, start, both, none),
  `color` and `weight`. Use them to mean something (red for where it breaks), not to decorate.
