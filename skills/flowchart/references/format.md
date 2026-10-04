# flowchart.json format

```jsonc
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
```

**Looks** (all optional): boxes, pills, decisions and text take `size` (`s`, `m`, `l`, `xl`), `fill`
(`white`, `paper`, `light`, `mid`, `dark`, `yellow`, `pink`, `blue`, `green`, `teal`, `none`),
`stroke` (`ink`, `grey`, `red`, `blue`, `green`, `orange`, `teal`, `none`) and `weight` (`thin`,
`normal`, `thick`). White with no stroke covers things up. Links take `shape` (`curved`, `angled`,
`straight`), `style` (`solid`, `dashed`, `dotted`), `head` (`end`, `start`, `both`, `none`),
`color`, `weight`, and `fromSide`/`toSide` (`left`, `right`, `top`, `bottom`) to pin which sides they use.
Cards can be cropped: `"crop": [left, top, right, bottom]` as fractions of the picture.

**Nodes** take `type` (default `box`), `text`, `frame`, and per type: `color` (stickies), `near`
(stickies, text, stamps and link cards sit beside or on top of that node, in its frame), `icon` and `at` (stamps),
`ref` (cards), `url` (link cards, or a clickable badge on anything else) and `product` (teal).

**Staying put.** Once the designer edits a board by hand, the editor pins everything that's on it
(`layout.<id>.x`/`y`, and frames in `canvas`), so nothing reshuffles when something small changes. New nodes you
add land next to whatever they're linked to. Don't remove pins unless asked; the designer has a **Tidy up** button
for that.

**Layout** is automatic. Each frame's linked nodes become a flow, laid out left to right (`"dir": "down"` on
the frame for top to bottom). Unlinked things go under the flow and read like an outline, in the order they're
written: a `text` followed by stickies (or cards, charts, links) becomes a column headed by that text, columns sit
side by side, a large text (`"size": "l"` or `"xl"`) starts a new section across the frame, and stickies with no
heading line up in a grid. Notes with `near` go beside their node, tied to it with a dotted line; stamps go on top
of theirs. You never write coordinates.

**Frames** go where `near` says: `"right of"`, `"left of"`, `"below"` or `"above"` another frame,
in the nearest free spot. Without `near`, each goes to the right of the last. Once the designer drags one,
its spot is saved in `canvas`, and it stays put.

**Cards** show other kits' work, drawn by those kits:
- `"./x.storyboard.json"` the whole storyboard, `"./x.storyboard.json#<panel id>"` one panel (Storyboard Kit)
- `"./x.wireframe.json"` the whole flow, `"./x.wireframe.json#<screen id>"` one screen (Wireframe Kit)
- `"./photo.jpg"` any image (a photo, a screenshot, a whiteboard), sketchified in grays to match;
  `"sketch": false` shows it as it is. The designer can also drop, paste or upload images in the editor
  (they're saved to `images/` next to the board).

Each kit writes its picture next to its file (`x.<panel>.png`). When the file is newer and the kit is
installed, the picture is redrawn automatically; otherwise the last one shows, marked "out of date".
`fc cards <board>` shows how each card is doing.

**Drawings** are the designer's: boxes, ovals, lines, arrows, freehand and free text, on the board
(`"shapes"`, canvas coordinates) or inside a frame (`frames.<id>.shapes`, frame coordinates, so they move
with it). Swimlanes are usually lines and text drawn in a frame.
