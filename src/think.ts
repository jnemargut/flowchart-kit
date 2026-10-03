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

Recipes for each of these (pushing back on a request, a messy brainstorm, comparing directions, mapping edge
cases, explaining a decision, kicking off, research findings, teardowns, service blueprints, site maps, cutting
scope, assumptions and risks, usability tests, before and after, visual direction):
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

## Kick off a project

For the first hour of something new, or a brief that's mostly vibes.

1. **Board**, one frame **The brief** with five text headings and stickies under each: *The problem* (one
   sentence, the person's words if you have them), *Who it's for*, *Already decided* (gray), *Unknowns* (pink),
   *How we'd know it worked* (green: a behavior, not a feature, e.g. "people stop asking the barista").
2. A link card for every source (ticket, doc, thread).
3. If the problem is a moment in someone's day, a 3 to 5 panel **storyboard** of it today, as cards beside the brief.

What you say: "Here's the brief as I understand it. The pink stickies are what I'd want answered before designing."

## Turn research into findings (interviews, survey answers, support tickets)

1. One sticky per observation, in the person's words where you can (quote marks), with who said it in small text.
   Don't paraphrase the interesting part away.
2. **Board**: cluster into frames named for the finding ("The ETA is a promise people plan around"), not the topic.
   Count how many people back each one in the frame's notes. Weak findings (one person) get a gray sticky saying so.
3. **Storyboard** the strongest finding as one real person's day, with their actual quotes in the bubbles and
   thoughts. Credit composites honestly ("based on P3 and P7") in the board's notes.
4. A frame **So what** with 2 or 3 text notes, and **Still don't know** with pink stickies.

## Teardown: how others do it

Needs the designer's screenshots (you can't reliably fetch other products' screens); ask for them if missing.

1. One frame per product, each a row of image cards in flow order (\`"sketch": false\` keeps them readable), a
   text note under each step, and the step count in the frame title ("Rival A · 7 steps").
2. Green stickies for what each does well, pink for where it hurts. Link cards to the live pages.
3. A frame **What we'd steal / avoid**.

## Service blueprint: what has to happen behind the scenes

When the experience depends on staff, other systems or timing (orders, bookings, deliveries, support).

1. Four frames stacked top to bottom (\`"near": ["below", "<frame above>"]\`), each a lane running right:
   **What the person does**, **What the product shows** (\`product: true\` steps), **What staff do** (behind the
   counter, out of sight), **Systems** (the POS, the queue, notifications).
2. Line steps up across lanes in time order and link across lanes where one thing triggers another (dashed for
   "nothing triggers this", which is usually the bug: "the app said 4 minutes" because nothing tells it otherwise).
3. Pink stickies on every hand-off nobody owns. A storyboard card at the top for the moment that matters most.

## Site map

1. **Flowchart**, one frame with \`"dir": "down"\`: the home or entry screen at the top, each section below it,
   screens under their section. Pills for entry points (a link, a notification, search).
2. Wireframe cards for the few screens that matter, beside their boxes.
3. Pink stickies for orphans (screens nothing links to) and dead ends (screens with no way out). Gray for screens
   planned but not designed.

## Cut the scope

1. Three frames left to right: **Now**, **Next**, **Later**. Stickies for each capability, in the frame where it
   belongs, with a one-line reason.
2. **Wireframe** the smallest version (only the Now screens) and the full version side by side as cards, so the
   difference is visible, not argued.
3. A text note per frame: what a person can do at that stage that they couldn't before.

What you say: "Now gets Marcus a text when it's late. Everything else waits until we know he reads it."

## Assumptions and risks

1. Stickies for everything that has to be true for this to work ("people check the app while they wait", "baristas
   will update the status").
2. **Board**: a frame per level, **Risky and unknown** (pink), **Risky but known**, **Safe** (gray). Within the
   risky frame, order by how much breaks if it's wrong.
3. For the top three, a green sticky with the cheapest test: five interviews, a fake door, a day of logs, a
   barista shadowing shift. Name what result would change the plan.

## Plan a usability test

1. **Wireframes** of the flow, linked so Play mode clicks through. That's the prototype.
2. **Board**: a frame **Tasks** (3 to 5, written as the person's goal, never the button: "Order your usual for
   pickup", not "Tap Reorder"), a frame **What we're watching** (where they hesitate, what they say out loud, if
   they find X), and a frame **Who** (who to recruit, how many).
3. Wireframe cards beside each task for where it should end. Pink stickies for what would count as a fail.

## Before and after

The most persuasive thing to bring to a stakeholder.

1. **Storyboard** today and the proposed future with the same person, the same trigger and the same shot order, so
   panels line up. The difference should be one or two panels, not everything.
2. **Board**: two frames side by side (\`"near": ["right of", "before"]\`), storyboard cards in the same order,
   and a text note under the panels that changed: what's different and why it matters.
3. Wireframe cards only for the screens that make the "after" possible.

## Visual direction (a moodboard)

Only when the question is about look, feel or visual style. It's the one recipe where real color belongs.

1. Ask for the designer's references (screenshots, photos, products they admire). Image cards with
   \`"sketch": false\`, so their colors show. You can't reliably find and license images yourself; say so.
2. Mood words as big text nodes ("warm", "unhurried", "tactile"), 3 to 5, and one or two words it is *not*.
3. A palette: small boxes with hex fills (\`{ "type": "box", "text": "Honey #E8B04B", "fill": "#e8b04b" }\`),
   4 to 6 per direction. The designer can pick any color, or use the dropper on a reference, in the editor.
4. Type: text nodes naming a heading and body font pairing and why (the board shows the names, not the fonts).
5. Two or three directions as frames side by side, each with its own images, words, palette and type, and a frame
   **Pick one** with what each direction would do to the product. Then stop; this isn't a design system.

## Wiring cheatsheet

- Board card of a storyboard panel: \`{ "type": "card", "ref": "./x.storyboard.json#panel-id" }\` (or the whole board
  without \`#\`). \`fc cards\` lists the ids.
- Board card of a wireframe screen: \`{ "type": "card", "ref": "./x.wireframe.json#screen-id" }\`; the whole flow without \`#\`.
- Storyboard phone showing a wireframe screen: \`"device": { "type": "phone", "screen": "./x.wireframe.json#screen-id" }\`.
- A tap on a screen card: \`{ "type": "stamp", "icon": "cursor", "near": "<card id>", "at": [0.5, 0.8] }\`.
- A ticket: \`{ "type": "link", "text": "ORDER-412: late alerts", "url": "https://…" }\`.
- Slides: \`"present": ["ask", "today", "flow", "options", "questions"]\`, and \`notes\` on each frame.
- Pictures for cards are made by each kit next to its file; if a kit isn't installed, the last picture still shows.
- Any color: fills, borders, arrows, sticky paper and drawings take a hex (\`"fill": "#e8b04b"\`) as well as the named colors.
  Keep to the named grays except where color is the point (a palette, a status everyone already reads by color).
`;
