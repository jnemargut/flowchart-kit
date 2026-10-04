# Plays

Recipes for common situations. Mix and trim; these are starting points, not templates to fill in.

**Every board, whatever the recipe, has to make sense to someone who wasn't there.** The frames below are what
goes *after* a first frame that gives the answer. So: a first frame whose `description` says what you found. A
title that says something and a `description` on every frame. Notes in columns under short `text` headings,
never in a pile. `present` in the order you'd tell it. A last frame for what happens next. And plain words
throughout: write it the way you'd say it. The recipes name frames by what goes in them ("The ask", "Options").
Give each one a title that says what it turned out to show ("The ask fixes the timer. The wait is the problem.").
`fc critique` checks all of this.

## Push back on a request ("the PM wants X")

The designer suspects the ask treats a symptom.

1. Gather the tickets. Find the user moment the ask is about.
2. **Storyboard** that moment as it happens today (the trigger before the product, the workaround people use, how
   it feels). The insight usually lives in the workaround panel.
3. **Board**: The answer (does the ask fix the real problem?) → The ask (link cards) → What actually happens (storyboard cards) → The ask, as a flow (with where it
   breaks marked) → One or two alternatives → Questions for the PM. If there's data that points at the real
   problem (most people drop off before the step the ask is about), a chart of it in "What actually happens" is
   the strongest argument you have. If there isn't, a pink sticky: "What would tell us which problem this is?"
4. Wireframe only the screens that make the difference between the ask and the alternative visible.

What you say: "The ticket fixes the timer. The real problem is in panel 5. Nobody tells Marcus it's late, so he asks a
human. Option B texts him instead. Three questions before we pick."

## Make sense of a mess (notes, research, a long thread)

1. Read everything. Pull every distinct point out as a sticky (one idea each, a few words).
2. **Board**: cluster the stickies into frames by theme (3 to 6), named for what the cluster *means* ("People don't
   trust the ETA"), not its topic ("ETA"). Inside a frame, sub-group under text headings if there are more than
   five stickies. The first frame says what the mess adds up to.
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
2. **Board** as a deck: Why (storyboard cards, and a chart if a number makes the case) → What changes (wireframe
   cards) → What we're not doing (gray stickies) → What we need from you (pink stickies). Frame `notes` become speaker notes.
3. Offer `fc export <board> --pptx`.

## Kick off a project

For the first hour of something new, or a brief that's mostly vibes.

1. **Board**, one frame **The brief** with five text headings and stickies under each: *The problem* (one
   sentence, the person's words if you have them), *Who it's for*, *Already decided* (gray), *Unknowns* (pink),
   *How we'd know it worked* (green: a behavior, not a feature, e.g. "people stop asking the barista"). If today's
   number for that is known, a small chart of it under the heading: the baseline everyone will measure against.
2. A link card for every source (ticket, doc, thread).
3. If the problem is a moment in someone's day, a 3 to 5 panel **storyboard** of it today, as cards beside the brief.

What you say: "Here's the brief as I understand it. The pink stickies are what I'd want answered before designing."

## Turn research into findings (interviews, survey answers, support tickets)

1. One sticky per observation, in the person's words where you can (quote marks), ending with who said it.
   Don't paraphrase the interesting part away.
2. **Board**: cluster into frames named for the finding ("The ETA is a promise people plan around"), not the topic.
   Count how many people back each one in the frame's notes. Weak findings (one person) get a gray sticky saying so.
   When the counts are the point (8 of 12 asked about the ETA), one `hbar` chart across the findings, the
   strongest highlighted; small samples stay counts ("8 of 12"), never percentages.
3. **Storyboard** the strongest finding as one real person's day, with their actual quotes in the bubbles and
   thoughts. Credit composites honestly ("based on P3 and P7") in the board's notes.
4. A frame **So what** with 2 or 3 text notes, and **Still don't know** with pink stickies.

## What the data says (a CSV, analytics, survey counts)

1. Do the math first, honestly: read the file with code, count and compare, and note what's missing or odd (a
   small sample, a weird week). Never make numbers up; if there's no data, say so and make it a pink sticky.
2. **Board**: a frame per finding, named for it ("Half the drop-off is at the cart"), each with **one chart** that
   shows it (`"type": "chart"`; funnel for steps, line for over time, bar or hbar to compare, pie or donut only for
   a few parts of a whole) and `highlight` on the part to look at. Two or three charts, not a dashboard.
3. Beside each chart a sticky with the takeaway in plain words, and a gray one with the caveat (sample size,
   where the numbers came from). Link to the source with a `link` card if there is one.
4. If a number points at a moment in someone's day (people giving up at the cart), a storyboard card of that
   moment next to it: the number says how many, the panel says why.

## Teardown: how others do it

Needs the designer's screenshots (you can't reliably fetch other products' screens); ask for them if missing.

1. One frame per product, each a row of image cards in flow order (`"sketch": false` keeps them readable), a
   text note under each step, and the step count in the frame title ("Rival A · 7 steps").
2. Green stickies for what each does well, pink for where it hurts. Link cards to the live pages.
3. A frame **What we'd steal / avoid**.

## Service blueprint: what has to happen behind the scenes

When the experience depends on staff, other systems or timing (orders, bookings, deliveries, support).

1. Four frames stacked top to bottom (`"near": ["below", "<frame above>"]`), each a lane running right:
   **What the person does**, **What the product shows** (`product: true` steps), **What staff do** (behind the
   counter, out of sight), **Systems** (the POS, the queue, notifications).
2. Line steps up across lanes in time order and link across lanes where one thing triggers another (dashed for
   "nothing triggers this", which is usually the bug: "the app said 4 minutes" because nothing tells it otherwise).
3. Pink stickies on every hand-off nobody owns. A storyboard card at the top for the moment that matters most.

## Site map

1. **Flowchart**, one frame with `"dir": "down"`: the home or entry screen at the top, each section below it,
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
   barista shadowing shift. Name what result would change the plan. If data already answers one, chart it next to
   the assumption and move the sticky to the frame it belongs in.

## Plan a usability test

1. **Wireframes** of the flow, linked with `goes` so it clicks through. That's the prototype: Play mode in the
   editor, or `wf export <file> --html` for one file a participant can open on their own machine.
2. **Board**: a frame **Tasks** (3 to 5, written as the person's goal, never the button: "Order your usual for
   pickup", not "Tap Reorder"), a frame **What we're watching** (where they hesitate, what they say out loud, if
   they find X), and a frame **Who** (who to recruit, how many).
3. Wireframe cards beside each task for where it should end. Pink stickies for what would count as a fail.
4. After the sessions, a frame **What happened**: per task, an `hbar` of how many got through (counts, not
   percentages, with five people), the worst one highlighted, and the quote that explains it beside it.

## Before and after

The most persuasive thing to bring to a stakeholder.

1. **Storyboard** today and the proposed future with the same person, the same trigger and the same shot order, so
   panels line up. The difference should be one or two panels, not everything.
2. **Board**: two frames side by side (`"near": ["right of", "before"]`), storyboard cards in the same order,
   and a text note under the panels that changed: what's different and why it matters.
3. Wireframe cards only for the screens that make the "after" possible.
4. If there's a number that should move (wait time, drop-off, how many ask a human), a small chart under each
   frame: today's real number, and the "after" as a goal on a gray sticky. Never draw a made-up "after" as data.

## Visual direction (a moodboard)

Only when the question is about look, feel or visual style. It's the one recipe where real color belongs.

1. Ask for the designer's references (screenshots, photos, products they admire). Image cards with
   `"sketch": false`, so their colors show. You can't reliably find and license images yourself; say so.
2. Mood words as big text nodes ("warm", "unhurried", "tactile"), 3 to 5, and one or two words it is *not*.
3. A palette: small boxes with hex fills (`{ "type": "box", "text": "Honey #E8B04B", "fill": "#e8b04b" }`),
   4 to 6 per direction. The designer can pick any color, or use the dropper on a reference, in the editor.
4. Type: text nodes naming a heading and body font pairing and why (the board shows the names, not the fonts).
5. Two or three directions as frames side by side, each with its own images, words, palette and type, and a frame
   **Pick one** with what each direction would do to the product. Then stop; this isn't a design system.

## Wiring cheatsheet

- Board card of a storyboard panel: `{ "type": "card", "ref": "./x.storyboard.json#panel-id" }` (or the whole board
  without `#`). `fc cards` lists the ids.
- Board card of a wireframe screen: `{ "type": "card", "ref": "./x.wireframe.json#screen-id" }`; the whole flow without `#`.
- Storyboard phone showing a wireframe screen: `"device": { "type": "phone", "screen": "./x.wireframe.json#screen-id" }`.
- A tap on a screen card: `{ "type": "stamp", "icon": "cursor", "near": "<card id>", "at": [0.5, 0.8] }`.
- A ticket: `{ "type": "link", "text": "ORDER-412: late alerts", "url": "https://…" }`.
- A rough chart: `{ "type": "chart", "kind": "bar", "text": "Orders by day", "data": [["Mon", 42], ["Tue", 38]], "highlight": "Tue", "unit": "orders" }`.
  A wireframe screen can show the same numbers: `{ "type": "chart", "kind": "line", "data": [...] }`.
- Slides: `"present": ["ask", "today", "flow", "options", "questions"]`, and `notes` on each frame.
- Pictures for cards are made by each kit next to its file; if a kit isn't installed, the last picture still shows.
- Any color: fills, borders, arrows, sticky paper and drawings take a hex (`"fill": "#e8b04b"`) as well as the named colors.
  Keep to the named grays except where color is the point (a palette, a status everyone already reads by color).
