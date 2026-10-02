# Plays

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
   stickies) → What we need from you (pink stickies). Frame `notes` become speaker notes.
3. Offer `fc export <board> --pptx`.

## Wiring cheatsheet

- Board card of a storyboard panel: `{ "type": "card", "ref": "./x.storyboard.json#panel-id" }` (or the whole board
  without `#`). `fc cards` lists the ids.
- Board card of a wireframe screen: `{ "type": "card", "ref": "./x.wireframe.json#screen-id" }`; the whole flow without `#`.
- Storyboard phone showing a wireframe screen: `"device": { "type": "phone", "screen": "./x.wireframe.json#screen-id" }`.
- A tap on a screen card: `{ "type": "stamp", "icon": "cursor", "near": "<card id>", "at": [0.5, 0.8] }`.
- A ticket: `{ "type": "link", "text": "ORDER-412: late alerts", "url": "https://…" }`.
- Slides: `"present": ["ask", "today", "flow", "options", "questions"]`, and `notes` on each frame.
- Pictures for cards are made by each kit next to its file; if a kit isn't installed, the last picture still shows.
