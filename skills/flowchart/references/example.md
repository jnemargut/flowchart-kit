# Worked example

Prompt: *"Map what happens when a Corner Coffee order runs late. Use the late latte storyboard and the order
status screen, and park a few ideas."*

First, `fc cards` finds `late-latte.storyboard.json` (panels: order-ahead, walking, in-line, checks-app,
later, asks, commute) and `order-ahead.wireframe.json` (screens: menu, drink, cart, status).

```json
{
  "title": "What happens when the order runs late",
  "frames": {
    "happy": { "title": "Happy path", "notes": "This is the flow we designed for. It works when the shop is quiet." },
    "late": { "title": "When it runs late", "near": ["right of", "happy"], "notes": "This is what actually happens at 8am. The app keeps saying 4 minutes and Marcus asks a human." },
    "ideas": { "title": "Ideas", "near": ["below", "late"], "notes": "Three directions to test next week.", "url": "https://example.atlassian.net/browse/ORDER-400" }
  },
  "nodes": {
    "leave": { "type": "pill", "text": "Leaves home", "frame": "happy" },
    "order": { "text": "Orders a latte ahead", "frame": "happy", "product": true },
    "ready": { "type": "diamond", "text": "Ready on time?", "frame": "happy" },
    "go": { "type": "pill", "text": "Grabs it and goes", "frame": "happy" },
    "eta": { "type": "sticky", "text": "The app promises 4 minutes", "near": "order" },

    "wait": { "text": "Waits at the counter", "frame": "late" },
    "check": { "text": "Checks the app: still says 4 min", "frame": "late", "product": true },
    "screen": { "type": "card", "ref": "./order-ahead.wireframe.json#status", "frame": "late" },
    "ask": { "text": "Asks the barista", "frame": "late", "stroke": "red", "weight": "thick" },
    "panel": { "type": "card", "ref": "./late-latte.storyboard.json#asks", "frame": "late" },
    "missed": { "type": "pill", "text": "Late for the 8:40", "frame": "late" },
    "never": { "type": "sticky", "text": "Is \"4 min\" *ever* true at **8am**?", "color": "pink", "near": "check" },
    "tap": { "type": "stamp", "icon": "cursor", "near": "screen", "at": [0.5, 0.36] },
    "sad": { "type": "stamp", "icon": "frown", "near": "ask" },
    "trust": { "type": "text", "text": "where **trust** breaks", "near": "ask" },

    "text-me": { "type": "sticky", "text": "Text me when it's actually ready", "color": "blue", "frame": "ideas" },
    "queue": { "type": "sticky", "text": "Show the real queue, not a timer", "color": "blue", "frame": "ideas" },
    "bump": { "type": "sticky", "text": "Let the barista bump the ETA", "color": "green", "frame": "ideas" },
    "refund": { "type": "sticky", "text": "Refunds for really late orders (later)", "color": "gray", "frame": "ideas" },
    "ticket": { "type": "link", "text": "ORDER-412: late order alerts", "url": "https://example.atlassian.net/browse/ORDER-412", "frame": "ideas" },
    "best": { "type": "stamp", "icon": "star", "near": "text-me" }
  },
  "links": [
    { "from": "leave", "to": "order" },
    { "from": "order", "to": "ready" },
    { "from": "ready", "to": "go", "label": "yes" },
    { "from": "ready", "to": "wait", "label": "no" },
    { "from": "wait", "to": "check" },
    { "from": "check", "to": "screen", "style": "dotted", "head": "none" },
    { "from": "check", "to": "ask", "label": "after 10 min" },
    { "from": "ask", "to": "panel", "style": "dashed" },
    { "from": "ask", "to": "missed" }
  ],
  "present": ["happy", "late", "ideas"]
}
```

Why it works: three frames tell the story in order (and become three slides), the happy path's decision has a
labeled way out for each answer, and "no" crosses into the late frame. The late frame shows the real thing:
the status screen with a cursor stamp on it, and the storyboard panel where Marcus asks a human. Steps are a few
words each; the thinking lives on stickies beside them. Teal marks where the product shows up, and there's no
teal where trust breaks. Ideas are a wall of stickies with a star on the favorite and a link to the ticket.
