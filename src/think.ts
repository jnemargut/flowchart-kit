/**
 * /low-fi-think: the orchestration skill that ships next to /flowchart. No drawing code of its own: it reads the
 * ask, decides which kits the thinking needs, and builds connected low-fi artifacts with them.
 */

export const THINK_MD = `---
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
| Storyboard Kit | A person's real day around the product: where it helps, where they route around it | \`../storyboard/\` |
| Wireframe Kit | Screens and the flow between them | \`../wireframe/\` |
| Flowchart Kit | The canvas: flows, decisions, stickies, links, and cards showing the other two; frames become slides | \`../flowchart/\` |

The folders are relative to this skill's folder (\`\${CLAUDE_SKILL_DIR}\`). **Before you write a kit's file, read
that kit's SKILL.md and follow it**: its vocabulary, its checks, its craft notes. This skill is the plan; theirs
are the how.

## 0. See what's installed

\`\`\`bash
node "\${CLAUDE_SKILL_DIR}/../flowchart/scripts/flowchart.mjs" kits
\`\`\`

It prints each installed kit, where its docs are, and a shell function for each (\`sb() { node "…" "$@"; }\`).
Define those functions in your shell and use \`sb\`, \`wf\` and \`fc\` like commands. Use functions, not variables
(\`SB="node …"; $SB\` breaks in zsh). If each of your commands runs in a fresh shell, start each one with the
function lines you need. If a kit is missing, work without it (see "When a kit isn't there") and tell
the designer which one would help.

## 1. Gather

Read everything the designer pointed at, with whatever tools you have: a Jira or Linear MCP or CLI for tickets
(and their linked tickets, comments and acceptance criteria), docs and wikis, Slack threads, Figma links, web
pages. Also look in the working folder for existing storyboards, wireframes and boards (\`fc cards\` lists them).

If you can't open something, say which link and ask them to paste it. Don't guess what a ticket says. Keep each
source's real address (the Jira URL, the doc link) for its link card on the board; if a ticket only exists as a
file the designer gave you, point at the file (\`"url": "./tickets/PAY-218.md"\`).

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

Make a folder named for the topic (\`late-orders/\`) and keep every file in it, so cards can point at each other
with short relative paths. Storyboards and wireframes feed each other, so go in this order:

1. **Storyboard, rough** (if used): the person's day *today*, before the product's change. 5 to 8 panels, with the
   moment the ask is about in the middle. Leave phones generic (\`"device": "phone"\`) for now.
2. **Wireframes** (if used), one file per flow:
   - \`today.wireframe.json\`: only the screens the storyboard needs to show what people see *today* (often one or
     two). Skip it if a generic screen tells the story.
   - \`ask.wireframe.json\`: the screens the request implies.
   - \`option-b.wireframe.json\` and so on: one file per option you sketch, even if it's a single screen.
   \`wf validate\` each, then \`wf render <file>\` so every screen has a picture.
3. **Storyboard, wired**: point its phones at the real screens (\`"screen": "./today.wireframe.json#status"\`),
   then \`sb validate\` and \`sb critique\`, and fix what makes it truer.
4. **The board** (almost always): \`<topic>.flowchart.json\`. This is what the designer opens and presents. Default
   frames, in story order (drop the ones you don't need):
   - **The ask**: a \`link\` card per ticket or doc (\`"url"\`), the requirements as yellow stickies, the "why" as
     text. Faithful to the source: this frame is the requester's view, not yours.
   - **What actually happens**: the storyboard as cards (the whole board, or the 2 or 3 panels that matter), linked
     in order, with stickies where it hurts and a \`frown\` stamp on the worst moment.
   - **The ask, as a flow**: steps and decisions of what's being requested, with wireframe screens as cards. Mark
     where it breaks: a red \`stroke\` on the step, a red sticky saying why.
   - **Options**: one frame each (2 or 3 at most). Each a short flow, its key screen as a card, and a green sticky for
     what it gets right, a pink one for what it costs. A \`star\` stamp on the one you'd pick, if you'd pick one.
   - **Questions for the PM**: pink stickies, each one answerable. Assumptions you made: gray stickies starting with
     "Assuming…".
   Place frames by relation (\`"near": ["right of", "ask"]\`), set \`present\` to the story order, and give each
   frame \`notes\` (what to say when it's on screen). \`fc validate\`, then \`fc render\` and *look at the PNG*: fix
   anything crowded, cut off or confusing.

Stamps, colors and emphasis carry meaning, not decoration: teal (\`"product": true\`) only where the product
shows up, red for where it breaks, a \`cursor\` stamp where someone taps, **bold** for the one word that matters.

More recipes (pushing back on a request, a messy brainstorm, comparing directions, explaining a decision):
[references/plays.md](references/plays.md).

## 5. Hand it over

Open the board: \`fc dev <topic>/<topic>.flowchart.json\` (in the background), and give the designer the URL. Then a
short message, not a report:
- What you made, in a line per artifact, with its file.
- What you think, in two or three sentences: where the ask holds up, where it doesn't, what you'd do.
- The questions you'd take back to the PM, in a list.
- What you assumed.

Offer the next step in one line: "Want the options as wireframes?", "Should I make a deck of this for the PM?"
(\`fc export <file> --pptx\` or \`--pdf\`).

## Keep going together

The designer will edit things by hand and talk to you. Re-read files before every change; their edits win. Boards
pin what's on them once edited, so add new things freely: they land next to what they link to. If the designer
pastes a pointer ("In late-orders.flowchart.json, frame…"), that's exactly what to change. When a direction firms
up, the next step may be real design work (a fuller wireframe set, or a decision process like \`/x-product-design\`
if it's installed); say so rather than over-polishing low-fi artifacts.

## When a kit isn't there

- **No Storyboard Kit**: tell the day as a flow on the board with \`text\` notes and \`frown\`/\`smiley\` stamps for how
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
`;

export const PLAYS_MD = `# Plays

Recipes for common situations. Mix and trim; these are starting points, not templates to fill in.

## Push back on a request ("the PM wants X")

The designer suspects the ask treats a symptom.

1. Gather the tickets. Find the user moment the ask is about.
2. **Storyboard** that moment as it happens today (the trigger before the product, the workaround people use, how
   it feels). The insight usually lives in the workaround panel.
3. **Board**: The ask (link cards) → What actually happens (storyboard cards) → The ask, as a flow (with where it
   breaks marked) → One or two alternatives → Questions for the PM.
4. Wireframe only the screens that make the difference between the ask and the alternative visible.

What you say: "The ticket fixes the timer. Panel 5 is the real problem: nobody tells Marcus it's late, so he asks a
human. Option B texts him instead. Three questions before we pick."

## Make sense of a mess (notes, research, a long thread)

1. Read everything. Pull every distinct point out as a sticky (one idea each, a few words).
2. **Board**: cluster the stickies into frames by theme (3 to 6), named for what the cluster *means* ("People don't
   trust the ETA"), not its topic ("ETA").
3. Add a frame **What this means** with 2 or 3 text notes, and **Open questions** with pink stickies.
4. Storyboard or flowchart only if one theme clearly needs it.

## Compare directions

1. One frame per direction (2 or 3). Each: a short flow of the key steps, the screen that makes it different as a
   wireframe card, a green sticky (what it gets right) and a pink one (what it costs).
2. A final frame **Side by side**: the same 3 or 4 questions answered for each (as text or stickies in columns,
   swimlanes drawn as lines if it helps).
3. Star the one you'd pick and say why in the frame's notes, or say it's a toss-up and what would decide it.

## Map a flow and its edge cases

1. **Flowchart** first: the happy path in one frame (pills for start and end, decisions labeled), then a frame per
   unhappy path (errors, empty states, "it's late", offline), linked from the decision where they branch.
2. Wireframe the screens at the branch points. Put them on the board as cards next to their steps (dashed links).
3. Pink stickies for every branch nobody has decided yet.

## Explain a decision to someone else

1. Storyboard the before and the after (two short boards, or one with a turn in the middle).
2. **Board** as a deck: Why (storyboard cards) → What changes (wireframe cards) → What we're not doing (gray
   stickies) → What we need from you (pink stickies). Frame \`notes\` become speaker notes.
3. Offer \`fc export <board> --pptx\`.

## Wiring cheatsheet

- Board card of a storyboard panel: \`{ "type": "card", "ref": "./x.storyboard.json#panel-id" }\` (or the whole board
  without \`#\`). \`fc cards\` lists the ids.
- Board card of a wireframe screen: \`{ "type": "card", "ref": "./x.wireframe.json#screen-id" }\`; the whole flow without \`#\`.
- Storyboard phone showing a wireframe screen: \`"device": { "type": "phone", "screen": "./x.wireframe.json#screen-id" }\`.
- A tap on a screen card: \`{ "type": "stamp", "icon": "cursor", "near": "<card id>", "at": [0.5, 0.8] }\`.
- A ticket: \`{ "type": "link", "text": "ORDER-412: late alerts", "url": "https://…" }\`.
- Slides: \`"present": ["ask", "today", "flow", "options", "questions"]\`, and \`notes\` on each frame.
- Pictures for cards are made by each kit next to its file; if a kit isn't installed, the last picture still shows.
`;
