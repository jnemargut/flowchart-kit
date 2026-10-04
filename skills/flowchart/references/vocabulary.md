# Flowchart vocabulary

Generated from the tool. Query live with `fc vocab`.

## Node types

### `box`: Step

A step: something a person or the product does. The default, so you can leave `type` out.

```json
{"text":"Orders a latte ahead","frame":"happy"}
```

### `pill`: Start / end

Where a flow starts or ends.

```json
{"type":"pill","text":"Leaves home","frame":"happy"}
```

### `diamond`: Decision

A question with more than one way out. Label the links that leave it ("yes", "no").

```json
{"type":"diamond","text":"Ready on time?","frame":"happy"}
```

### `sticky`: Sticky

A sticky note: a question, an insight, an idea. `near` sticks it beside a node; `color` picks the paper.

```json
{"type":"sticky","text":"Is \"4 min\" ever true at 8am?","color":"pink","near":"ready"}
```

### `text`: Text

Loose hand-written words: a heading, a lane name, a comment. `near` puts it beside a node.

```json
{"type":"text","text":"Nobody tells them it's late","near":"wait"}
```

### `stamp`: Stamp

A little marker icon: a click cursor on a screen, a star on what matters, a smiley or a frown on a feeling. `near` puts it on top of a node, `at` says where on it.

```json
{"type":"stamp","icon":"cursor","near":"status-screen","at":[0.5,0.82]}
```

### `link`: Link

A web page as a card: a site, a ticket, a doc, a prototype. `text` is its title, `url` where it goes. (Any other node can carry a `url` too.)

```json
{"type":"link","text":"ORDER-412: late order alerts","url":"https://example.atlassian.net/browse/ORDER-412","near":"late-alert"}
```

### `chart`: Chart

A rough chart from a few numbers: bars, rows (sideways bars, for long labels), a line, a funnel, a pie or a donut. `text` is its title, `data` the numbers, `highlight` what to call out. Directional, not precise: every number is written on it.

```json
{"type":"chart","kind":"funnel","text":"Where people drop off","data":[["Browse",1200],["Cart",640],["Checkout",410],["Paid",210]],"highlight":"Cart","unit":"people","frame":"data"}
```

### `card`: Card

A storyboard, a storyboard panel, a wireframe flow or screen, or an image, pointed at by `ref` and drawn by its own kit. Link to and from it like any step.

```json
{"type":"card","ref":"./late-latte.storyboard.json#in-line","frame":"late"}
```

## Node properties

- `type`: box | pill | diamond | sticky | text | stamp | link | chart | card (default box)
- `text`: the words on it
- `frame`: the frame it lives in (leave out for the loose area)
- `color`: stickies: yellow | pink | blue | green | gray (default yellow); charts: the accent, ink | grey | red | blue | green | yellow; or any hex like "#e8b04b"
- `kind`: charts: bar | hbar | line | funnel | pie | donut (default bar). hbar is sideways bars, for long labels
- `data`: charts: the numbers, [["Browse", 1200], ["Cart", 640]] or { "Browse": 1200, "Cart": 640 }
- `highlight`: charts: a label (or a list of them) to call out in the accent color; the rest stay gray
- `unit`: charts: goes on every number: "%", "$", "people", "min"
- `values`: charts: false hides the numbers
- `near`: stickies and text: the id of the node to sit beside; stamps: the node to sit on top of
- `icon`: stamps: cursor | star | smiley | meh | frown | heart | thumbs-up | thumbs-down | question | alert | check | cross | idea | flag | clock | eye | fire | dollar
- `at`: stamps on a node: [x, y] as fractions of it (default [1, 0], its top-right corner)
- `ref`: cards: a path to a storyboard, panel, wireframe, screen or image
- `crop`: cards: [left, top, right, bottom] as fractions of the picture (the editor's Crop button writes it)
- `sketch`: image cards: false shows the picture as it is (default: sketchified in grays to match)
- `mirror`: image cards: true flips the picture left to right
- `turn`: image cards: turn the picture clockwise, 90 | 180 | 270
- `url`: a web address; link cards show it, anything else gets a clickable link badge
- `product`: true draws it teal: this is where the product shows up
- `size`: text size: s | m (default) | l | xl
- `fill`: boxes, pills, decisions, text: white | paper | light | mid | dark | yellow | pink | blue | green | teal | none, or any hex like "#e8b04b" (a color swatch is a small box with a hex fill)
- `stroke`: border color: ink | grey | red | blue | green | orange | teal | none, or any hex
- `weight`: border weight: thin | normal (default) | thick

## Sticky colors

- `yellow`: the default: notes, observations
- `pink`: questions, worries, pain points
- `blue`: ideas
- `green`: what works, decisions made
- `gray`: parked, out of scope

## Stamps

- `cursor`: a click or tap happens here
- `star`: something special, the best bit
- `smiley`: this feels good
- `meh`: this feels so-so
- `frown`: this feels bad
- `heart`: people love this
- `thumbs-up`: yes, keep it
- `thumbs-down`: no, cut it
- `question`: an open question
- `alert`: a problem or a risk
- `check`: done, decided, works
- `cross`: wrong, broken, doesn't work
- `idea`: an idea
- `flag`: a milestone, or come back to this
- `clock`: waiting, or it takes time
- `eye`: people look here
- `fire`: urgent, or hot
- `dollar`: money changes hands

## Frame properties

- `title`: the name on the frame (and the slide title in Play)
- `near`: ["right of" | "left of" | "below" | "above", "<frame id>"]: placed next to that frame, in the nearest free spot
- `dir`: "right" (default) or "down": which way its flow runs
- `notes`: speaker notes for when it's a slide
- `url`: a web address for the whole frame (the spec, the epic, the prototype)

## Link properties

- `from`: node id
- `to`: node id
- `label`: a word or two on the arrow ("yes", "no", "after 10 min")
- `style`: "solid" (default), "dashed" (maybe, later) or "dotted" (a weak or implied link)
- `shape`: "curved", "angled" (right-angle elbows) or "straight" (default: the board's "connectors", else curved)
- `head`: arrowheads: "end" (default), "start", "both" or "none" (a plain line)
- `color`: ink | grey (default) | red | blue | green | orange | teal, or any hex
- `weight`: thin | normal (default) | thick
- `fromSide`: which side it leaves from: "left" | "right" | "top" | "bottom" (default: the layout picks)
- `toSide`: which side it arrives on (same choices)
- `bend`: [dx, dy]: pulls the arrow's middle that far from where the layout puts it, to route around things. Editor-owned: the designer drags the arrow's middle handle. Leave it out.
- `size`: the label's text size: s | m (default) | l | xl
