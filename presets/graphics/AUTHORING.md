# Writing a graphic

A graphic is a small web page drawn over the video, in a box on the frame. This is the format a person writes one in,
and the format a language model writes and edits one in: every preset here is written in it, so they double as
examples. The runtime that plays it is [`sandboxed-graphic-runtime.js`](../../apps/studio/src/core/graphics/infrastructure/sandbox/sandboxed-graphic-runtime.js); the
design behind it is [GRAPHICS_TASK.md](../../docs/GRAPHICS_TASK.md). What makes one look designed and keeps it from
breaking (type, placement, motion, the checks before showing one) is the
[graphic-design skill](../../.claude/skills/graphic-design/SKILL.md).

## The files

A graphic is four things, one folder per preset:

| File | What it holds |
|---|---|
| `graphic.html` | The body of the page: what the graphic is made of |
| `graphic.css` | How it looks |
| `graphic.js` | How it moves, and what it does with its fields |
| `preset.json` | Its name, its family, its fields, its shape and its box |

```json
{
  "id": "follow-pill",
  "order": 9,
  "name": "Follow pill",
  "description": "A pill that pops in",
  "category": "social",
  "aspectRatio": 3.4,
  "box": { "kind": "box", "centerX": 0.5, "centerY": 0.82, "width": 0.7 },
  "fields": [
    { "id": "text", "label": "Text", "kind": "text", "defaultValue": "Follow for more" },
    { "id": "background", "label": "Background", "kind": "color", "defaultValue": "#ffd400" }
  ]
}
```

- **`name`** and **`description`**: what the presets panel calls it, and what it is for in a few words. The card shows
  the name; the description shows as its tooltip and is searched with the name, so say what the graphic is (*A
  profile card whose button is pressed*), not how it looks.
- **`category`**: the family the presets panel lists it under: `hooks` (the promise of the video in its first
  seconds, text the user rewrites every time), `speakers` (who is talking), `social` (calls to act
  on a platform: follow, comment, message, a link) or `info` (what the video says or where it is: progress, a
  number). A new family is added to `GraphicPresetCategory` with its label.
  The hooks lead the panel on the video's first shot, where a new graphic starts as the first hook, and close it
  on any other. A hook stays for its whole shot like any graphic: the user splits the shot where it should end.
- **`hidesCaptions`** (optional, `false` by default): `true` keeps the captions off the graphic's shot, for a graphic
  that carries the line being said, as every hook does. The user switches it in *Content*.
- **`aspectRatio`**: the box's width over its height, from 1:50 to 50:1. The page is laid out in a box of that shape.
- **`box`**: where it is meant to sit. `{ "kind": "full" }` for the whole frame, or a box: its centre (`centerX`,
  `centerY`) and its `width`, shares of the frame (0 is the left or top edge, 1 the right or bottom). The user moves
  and resizes it afterwards.
- **`fields`**: the values a user sets without reading code. Each has an `id`, a `label`, a `kind` (`text`, `color`
  as `#rrggbb` or `#rrggbbaa`, `number`, `image` or `emoji`) and a `defaultValue` of that kind. An `emoji` is one
  glyph as text, picked in the editor's emoji picker, or `''` for none; draw it as text in a colour emoji font
  (`'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'`) and hide its place when empty. An `image` is a `data:` URL
  of a small picture (the editor scales the user's file to 256 px on its longest side), or `''` when none is set:
  default to `''` and draw something sensible without it, as the follow card draws an initial. Anything a user is likely to change
  (a name, a word, a colour, a count) is a field, never a constant buried in the code.
- **`motion`**: how the layer comes in and leaves as a whole, each the id of a layer animation of the Motion tab
  (`presets/layer/animation/`), or `{ "animation": id, ...its fields }` to set them, or `null` for none, the default:
  `{ "exit": { "animation": "layer-zoom-out-exit", "duration": 0.3, "intensity": 0.1 } }`. Picking the preset puts
  these in place of whatever the user had picked. A layer animation moves the whole box on top of whatever the code
  animates inside it, never instead of it, so leave the entrance to the code; give every preset an exit, one soft
  motion about half its entrance's length, or it cuts out when its shot ends.
- **`sounds`** (optional): the sounds the preset brings on its [moments](#moments), each
  `{ "moment": "press", "sound": "click-mouse", "volume": 0.25 }`, `sound` a bundled sound's id (the editor's sound
  library), `volume` from 0 to 1. `{ "edge": "entry" }` or `"exit"` in place of `moment` puts one on the layer's
  entry or exit, and `offset` (seconds, ±10, `0` by default) starts it before or after its spot; a preset the user
  saves writes these, a shipped one rarely needs them. The bundled sounds peak near full scale, so a sound that should sit under speech
  wants 0.15–0.25; the sound plays as the moment begins, and the bundled clicks, pops and dings hit within 20 ms. Picking the preset puts them on the layer in place of the last preset's; the user
  changes or removes them in the Sound tab. Give one only where a viewer would hear it in a real interface (a tap, a
  like, a message landing); a name on screen makes no sound.

## The page

- **The box is the viewport.** `100vw` and `100vh` are the box, not the frame; size everything in `vw`, `vh` or
  `vmin` so the graphic fills whatever size the box is drawn at. It is drawn at the box's size on the output, never
  stretched.
- **Transparent by default.** Whatever the page leaves unpainted shows the video. Do not paint `html` or `body`.
- **No network.** Nothing outside the page loads: no web fonts, no images by URL, no `fetch`. Draw with HTML, CSS,
  SVG inline, canvas or `data:` URLs.
- **Fonts are the bundled ones** ([FontFamilyCatalog](../../apps/studio/src/core/fonts/domain/FontFamilyCatalog.ts)):
  name one in `font-family` or a canvas's `font` and the page holds it, loaded before the code runs. A variable family
  also answers without ` Variable` (`'Inter'`). Anything else is the device's (`system-ui`, the colour emoji fonts),
  and differs from one device to the next.
- **No input.** It is a picture, not a page to use: no pointer, no keyboard.
- **Lay out with CSS, not with measurements.** `clamp()`, `vh`/`vw`, flex and grid fit a box of any size. Code that
  measures the page at load measures whatever the browser has laid out by then; the runtime waits for the frame to be
  the box and its bundled fonts loaded before the code runs, but a device font can still land after.

## Time

The editor asks for a moment, any moment, in any order: the first frame, then the last, then the middle. So:

- **Write `tscaps.render(t)`**, recommended: draw the state at `t` seconds since the graphic appeared, from `t`
  alone. Any moment can be asked at no cost, and the same `t` must always draw the same picture.
- Ordinary code also works: `requestAnimationFrame`, `setTimeout`, `setInterval`, `Date`, `performance.now` and CSS
  animations all run on the graphic's own clock, one frame at a time. Going back means replaying from 0, which costs
  time on a long graphic.
- `Math.random` is seeded: the same graphic draws the same thing every time.

## What the code is handed

| Name | What it is |
|---|---|
| `tscaps.params` | Each field's value, by its `id` |
| `tscaps.duration` | How long the graphic shows, in seconds |
| `tscaps.width`, `tscaps.height` | The box's size in pixels |
| `tscaps.render` | Set it to a function of `t`; the runtime calls it for every frame |
| `tscaps.moment(id, sec, label)` | Says something happens at `sec` (a button pressed, a heart liked), for a sound to be placed on |

`console.log` and anything thrown show in the graphic's Code tab, under its code.

## Moments

A graphic names the moments in it worth a sound, and the Sound tab lists each under its `label`, between the
layer's entrance and exit, where the user adds a sound on it. Declare them as the code first runs, with the second
the animation itself uses, so they can never drift apart:

```js
const PRESS = 1.3;
tscaps.moment('press', PRESS, 'Button pressed');
tscaps.render = (t) => { button.classList.toggle('pressed', t >= PRESS); };
```

- **`id`** is what a sound stays on: a short name of letters, digits, `-` or `_`. Keep it when the time or the label
  changes; a sound on an id the code stops declaring stays, marked detached, until the code declares it again.
- **`sec`** counts from when the graphic comes in, as `t` does. It can follow the fields or the length
  (`tscaps.duration - 0.5`); the editor reads it again whenever they change. A moment at or past the layer's end
  plays no sound.
- Declare every moment before the first frame: one declared from `render` is refused with a warning.
- Mark what a viewer would hear in a real interface (a tap, a like, a message arriving); not every step of the motion.

## A graphic, whole

```js
// graphic.js: reads its fields once, then draws any moment from t alone.
const pill = document.querySelector('.pill');
document.querySelector('.label').textContent = tscaps.params.text;
pill.style.setProperty('--background', tscaps.params.background);

tscaps.render = (t) => {
  const shown = Math.min(1, t / 0.4);
  pill.style.transform = `scale(${0.6 + 0.4 * shown})`;
  pill.style.opacity = String(shown);
};
```

How a graphic comes in and leaves the frame as a whole (a slide, a fade) is also offered by its layer's Motion tab;
the graphic's own code animates what is inside its box.
