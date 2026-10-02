# sketch/

The marker drawing kit shared by Storyboard Kit, Wireframe Kit and Flowchart Kit: tokens, fonts, the wobble
filter, sketchify (image baking), PNG rendering via resvg-wasm, diff-friendly JSON with field-level edits, the
local editor server helpers, and the editor pieces every canvas shares (the drawing toolbar, pan and zoom).

**This folder is the source.** Wireframe Kit and Flowchart Kit each keep an exact copy in `vendor/sketch/`
(`npm run sync-sketch` there), and its build fails if the copy is edited by hand. Fix things here first.

Keep it free of anything specific to storyboards, wireframes or flowcharts.
