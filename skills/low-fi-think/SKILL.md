---
name: low-fi-think
description: Think a product problem through with low-fi artifacts instead of prose. Reads the ask (Jira tickets, docs, Slack threads, links), works out what kind of thinking it needs, and builds connected storyboards, wireframes and a flowchart board with the Storyboard, Wireframe and Flowchart kits. Use when the user wants to rethink, make sense of, explore or push back on a request ("the PM wants X", "here are the Jiras"), work through a messy problem, compare options, or prepare something to bring back to a stakeholder, even if they don't name a kit.
---

# Thinking it through, low-fi

The designer brings you a problem, usually someone else's ask: "The PM wants me to do X, I need to rethink it,
here are a couple of Jiras." Your job is to help them think, the way a good design partner with a marker would:
read everything, then *show* your understanding as low-fi artifacts they can react to, poke at and present. Not
an essay. The artifacts are the conversation.

You do this with up to three kits, each its own skill:

| Kit | What it's for | Skill folder |
|---|---|---|
| Storyboard Kit | A person's real day around the product: where it helps, where they route around it | `../storyboard/` |
| Wireframe Kit | Screens and the flow between them | `../wireframe/` |
| Flowchart Kit | The canvas: flows, decisions, stickies, links, and cards showing the other two; frames become slides | `../flowchart/` |

The folders are relative to this skill's folder (`${CLAUDE_SKILL_DIR}`). **Before you write a kit's file, read
that kit's SKILL.md and follow it**: its vocabulary, its checks, its craft notes. This skill is the plan; theirs
are the how.

## 0. See what's installed

```bash
node "${CLAUDE_SKILL_DIR}/../flowchart/scripts/flowchart.mjs" kits
```

It prints each installed kit, where its docs are, and a shell function for each (`sb() { node "…" "$@"; }`).
Define those functions in your shell and use `sb`, `wf` and `fc` like commands. Use functions, not variables
(`SB="node …"; $SB` breaks in zsh). If each of your commands runs in a fresh shell, start each one with the
function lines you need. If a kit is missing, work without it (see "When a kit isn't there") and tell
the designer which one would help.

## 1. Gather

Read everything the designer pointed at, with whatever tools you have: a Jira or Linear MCP or CLI for tickets
(and their linked tickets, comments and acceptance criteria), docs and wikis, Slack threads, Figma links, web
pages. Also look in the working folder for existing storyboards, wireframes and boards (`fc cards` lists them).

If you can't open something, say which link and ask them to paste it. Don't guess what a ticket says. Keep each
source's real address (the Jira URL, the doc link) for its link card on the board; if a ticket only exists as a
file the designer gave you, point at the file (`"url": "./tickets/PAY-218.md"`).

Pull out, privately, before drawing anything:
- **The ask**: what's being requested, in the requester's words.
- **The why**: the problem or goal behind it, stated or implied.
- **Who it's for**, and the moment in their day it touches.
- **Constraints**: dates, platforms, dependencies, things already decided.
- **Gaps**: what's missing, vague or contradictory. These become the questions to bring back.
- **The designer's own doubt**: "rethink" usually means they suspect the ask solves the wrong thing. Find where.

## 2. Diagnose: what kind of thinking does this need?

| If the open question is… | Reach for |
|---|---|
| Is this a real problem? What actually happens to people today? | **Storyboard** of the current experience |
| What would the experience be? What do people see and tap? | **Wireframes** of the key screens and flow |
| What are the paths, branches, edge cases, options? Where does it break? | **Flowchart**: flows with decisions |
| Too many ideas, notes and unknowns to hold in your head | **Board of stickies** grouped into frames |
| Which of several directions? | **Flowchart** frames, one per option, each with the cards that show it |
| Something to bring back to the PM or the team | A **board with frames in story order**: it presents as slides |
| Where do we even start? (a new project, a vague brief) | **Kickoff** frame: problem, who, decided, unknowns, success |
| What did the research actually say? | **Findings**: themed stickies, then a storyboard in people's own words |
| How do others do this? | **Teardown**: their screens as image cards, a row per product |
| What has to happen behind the scenes for this to work? | **Service blueprint**: lanes for person, product, staff, systems |
| What screens exist and how do they connect? | **Site map**: every screen as a tree, top down |
| What's the smallest version worth building? | **Scope cut**: now / next / later, smallest version wireframed |
| What could make this fail? | **Assumptions and risks**, ranked, with a quick test for the top ones |
| Will people get it? | **Usability test plan**: a clickable flow, tasks, what to watch |
| Why change anything? | **Before and after**: today's storyboard beside the proposed one |
| What should it look and feel like? (only when asked about look, feel or visual style) | **Visual direction**: a moodboard |

Most rethinks need two or three of these, tied together on one board. Pick the smallest set that answers the
actual question. One sharp storyboard beats three half-done artifacts.

## 3. Say the plan in a breath, then go

Tell the designer in two or three lines what you'll make and why, for example:

> I'll storyboard what people do today when an order runs late (that's where I think the ticket's fix misses),
> sketch the two screens the ticket asks for, and put both on a board next to an alternative and the questions
> I'd ask before building anything.

Then start. Don't wait for approval unless they asked you to, or you genuinely can't tell what they want. Ask
at most one question up front; everything else becomes a pink sticky on the board.

## 4. Build, in order, in one folder

Make a folder named for the topic (`late-orders/`) and keep every file in it, so cards can point at each other
with short relative paths. Storyboards and wireframes feed each other, so go in this order:

1. **Storyboard, rough** (if used): the person's day *today*, before the product's change. 5 to 8 panels, with the
   moment the ask is about in the middle. Leave phones generic (`"device": "phone"`) for now.
2. **Wireframes** (if used), one file per flow:
   - `today.wireframe.json`: only the screens the storyboard needs to show what people see *today* (often one or
     two). Skip it if a generic screen tells the story.
   - `ask.wireframe.json`: the screens the request implies.
   - `option-b.wireframe.json` and so on: one file per option you sketch, even if it's a single screen.
   `wf validate` each, then `wf render <file>` so every screen has a picture.
3. **Storyboard, wired**: point its phones at the real screens (`"screen": "./today.wireframe.json#status"`),
   then `sb validate` and `sb critique`, and fix what makes it truer.
4. **The board** (almost always): `<topic>.flowchart.json`. This is what the designer opens and presents. Default
   frames, in story order (drop the ones you don't need):
   - **The ask**: a `link` card per ticket or doc (`"url"`), the requirements as yellow stickies, the "why" as
     text. Faithful to the source: this frame is the requester's view, not yours.
   - **What actually happens**: the storyboard as cards (the whole board, or the 2 or 3 panels that matter), linked
     in order, with stickies where it hurts and a `frown` stamp on the worst moment.
   - **The ask, as a flow**: steps and decisions of what's being requested, with wireframe screens as cards. Mark
     where it breaks: a red `stroke` on the step, a red sticky saying why.
   - **Options**: one frame each (2 or 3 at most). Each a short flow, its key screen as a card, and a green sticky for
     what it gets right, a pink one for what it costs. A `star` stamp on the one you'd pick, if you'd pick one.
   - **Questions for the PM**: pink stickies, each one answerable. Assumptions you made: gray stickies starting with
     "Assuming…".
   Place frames by relation (`"near": ["right of", "ask"]`), set `present` to the story order, and give each
   frame `notes` (what to say when it's on screen). `fc validate`, then `fc render` and *look at the PNG*: fix
   anything crowded, cut off or confusing.

Stamps, colors and emphasis carry meaning, not decoration: teal (`"product": true`) only where the product
shows up, red for where it breaks, a `cursor` stamp where someone taps, **bold** for the one word that matters.

Recipes for each of these (pushing back on a request, a messy brainstorm, comparing directions, mapping edge
cases, explaining a decision, kicking off, research findings, teardowns, service blueprints, site maps, cutting
scope, assumptions and risks, usability tests, before and after, visual direction):
[references/plays.md](references/plays.md).

## 5. Hand it over

Open the board: `fc dev <topic>/<topic>.flowchart.json` (in the background), and give the designer the URL. Then a
short message, not a report:
- What you made, in a line per artifact, with its file.
- What you think, in two or three sentences: where the ask holds up, where it doesn't, what you'd do.
- The questions you'd take back to the PM, in a list.
- What you assumed.

Offer the next step in one line: "Want the options as wireframes?", "Should I make a deck of this for the PM?"
(`fc export <file> --pptx` or `--pdf`).

## Keep going together

The designer will edit things by hand and talk to you. Re-read files before every change; their edits win. Boards
pin what's on them once edited, so add new things freely: they land next to what they link to. If the designer
pastes a pointer ("In late-orders.flowchart.json, frame…"), that's exactly what to change. When a direction firms
up, the next step may be real design work (a fuller wireframe set, or a decision process like `/x-product-design`
if it's installed); say so rather than over-polishing low-fi artifacts.

## When a kit isn't there

- **No Storyboard Kit**: tell the day as a flow on the board with `text` notes and `frown`/`smiley` stamps for how
  it feels.
- **No Wireframe Kit**: describe screens as boxes with a few words each, or ask for screenshots and use them as image
  cards.
- **No Flowchart Kit**: you're not here (this skill ships with it). Make the storyboard and wireframes, and list
  the questions in your message.

## Don't

- Don't write a long document. If you catch yourself writing paragraphs, put them on stickies.
- Don't invent facts the tickets don't say. Mark guesses as assumptions.
- Don't make every artifact possible. Make the ones that answer this question.
- Don't argue in prose with the ask. Show it: the storyboard panel where it fails beats a paragraph about why.
- Never mention other tools by name as inspiration in anything you write for the designer's stakeholders.
