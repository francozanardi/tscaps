# Graphics

A graphic is a small web page drawn over the video, in a box on the frame, below the captions. It opens with one shot and shows for that whole shot, or through a later one when asked (`through`). Use one for a name and role, a call to action, a progress bar, a counter, a list that ticks off, an arrow, a highlight: anything a motion designer would add over a talking video. A graphic can also be a b-roll the person does not have, drawn on demand in place of the video (see *Over the video, or in place of it*).

## Pick or write

- `list_catalog` with `graphic_presets` lists the ready-made ones and their fields. Each is for what its family says (a hook, text over the picture, a speaker, a call to action): there, add it with `add_graphic` and `preset` and set its fields with `params`.
- For a key moment of the video (the number, the word, the line that matters), write your own, set as below, unless a preset already reads that way.
- Write your own with `add_graphic` and `graphic` when no preset fits. To change one, `get_element` it first (you get its code, fields and the last errors), then `edit_graphic` with only the parts you change.
- A graphic shows for its whole shot. To show it for part of the video, split the shots first (`split_shots` before the words it should start and end on, or at times) and add it to the shot in between.
- To keep one graphic on screen while the shots under it change (a name card over an answer, a progress bar over the whole video), give `add_graphic` the last shot it shows on as `through` (for the whole video: the first shot, `through` the last): one graphic over those shots, never a copy on each.

## What you hand over

- `html`: the body of the page (no `<html>`, `<head>`, `<body>` or `<script>`: code goes in `js`).
- `css`: how it looks.
- `js`: how it moves and what it does with its fields.
- `fields`: what a person can change without reading code, each `{ id, label, kind, defaultValue }` with `kind` one of `text`, `color` (`#rrggbb` or `#rrggbbaa`), `number`, `image` (a `data:` URL, default `''`), `emoji` (one emoji, picked in the editor's emoji picker). Anything a person is likely to change (a name, a word, a colour, a number) is a field, never a constant buried in the code.
- `aspectRatio`: the box's width over its height (from 1/50 to 50). The page is laid out in a box of that shape.
- `box`: where its box sits first, always a picture in picture over the video: `{ "kind": "box", "centerX": 0.5, "centerY": 0.8, "width": 0.7 }` in shares of the frame (0 is the left or top edge, 1 the right or bottom). A b-roll graphic is laid out over the whole frame or half of it after, with `set_layer`.
- `motion`, optional: how the whole box enters and leaves, on top of what the code animates inside it. `entrance` and `exit` each take a layer motion's id (`list_catalog` with `layer_motions`), `{ "animation": id, ...its values }`, or `null` for none (the default: the code brings it in, and it stops when its shot ends). A soft exit, such as `{ "animation": "layer-fade-exit", "duration": 0.3 }`, keeps it from cutting out when its shot ends.
- `sounds`, optional: sounds on the moments the code declares (`tscaps.moment`, below), each `{ "moment": id, "sound": id }` with a bundled sound's id (`list_catalog` with `sounds`), placed right on its moment. Leave `volume` out: the default sits each sound under the voice (1 is the file's own level, far over a voice).

## Over the video, or in place of it

A graphic is one of two things, and its layout follows from which:

- **Over the video** (most graphics): a title, a number, a list, a name card, a call to action, a sticker. It sits in a box sized to what it holds, a picture in picture, so the person can pick it on the preview, move it and resize it. Never lay one of these out over the whole frame with the thing drawn small inside it: the person could no longer move or resize it, only the page around it.
- **In place of the video, as a b-roll**: a scene that shows what is being said when the person has no footage of it. A chart that builds, a diagram, a map, an animated illustration, a title card, a screen of data. Add it with `add_graphic` (it starts in a box), then `set_layer` it to `full` (the whole frame, the speaker hidden) or `split` (one part of the frame, the speaker re-framed into the other: the usual half screen). It must paint the whole of its part: give `body` a solid background of its own and lay everything out to fill any shape (`100vw` by `100vh`, which is that part). `set_layer` plays it there first and refuses one that leaves most of its part see-through.

Only a b-roll graphic paints its background; one over the video never does. The look below is for graphics over the video; a b-roll scene keeps its motion, type and colour rules, on a background of its own.

## The page

- **The box is the viewport.** `100vw` and `100vh` are the box, not the frame. Size everything in `vw`, `vh`, `vmin` or `clamp()`, so the graphic fills any size the box is drawn at.
- **Transparent by default.** Whatever the page leaves unpainted shows the video. Never paint `html` or `body`, except for a b-roll graphic, which paints its whole box.
- **No network.** Nothing outside the page loads: no web fonts, no images by URL, no `fetch`. Draw with HTML, CSS, inline SVG, canvas or `data:` URLs; in CSS, `url()` takes only `#id` (an SVG element of the page) and `data:`.
- **Fonts:** name one of tscaps' fonts in `font-family` (or a canvas's `font`) and it is loaded before your code runs: Inter Variable, Montserrat Variable, Poppins, Bricolage Grotesque Variable (sans); Anton, Bebas Neue, Oswald Variable (condensed); Playfair Display Variable, Fraunces Variable, EB Garamond Variable (serif, the last two with a true italic); Caveat Variable (handwritten). For any other font, a weight, or another alphabet, the `fonts` guide. Emoji are the device's.
- **It is a picture**, not a page to use: no pointer, no keyboard.
- **Lay out with CSS**, not with measurements taken at load: flex, grid, `clamp()`.

## Time

The editor asks for any moment, in any order (the last frame, then the first). So:

- **Write `tscaps.render = (t) => { ... }`**: draw the state at `t` seconds since the graphic appeared, from `t` alone. The same `t` must always draw the same picture. Never keep state that changes from one call to the next.
- `requestAnimationFrame`, timers, `Date`, CSS animations also run, on the graphic's own clock, but going back means replaying from 0. Prefer `render(t)`.
- `Math.random` is seeded: the same graphic draws the same thing every time.

What the code is handed:

| Name | What it is |
|---|---|
| `tscaps.params` | Each field's value, by its `id` |
| `tscaps.duration` | How long the graphic shows, in seconds (the length of the shots it shows on) |
| `tscaps.width`, `tscaps.height` | The box's size in pixels |
| `tscaps.render` | Set it to a function of `t` |
| `tscaps.moment(id, sec, label)` | Says something happens at `sec` (a tap, a like), so a sound can be placed on it. Call it before the first frame, with the same constant the animation uses |

Anything thrown or logged as an error is collected: `add_graphic` and `edit_graphic` play the graphic once and answer it as a warning, as they do when it drew nothing.

A whole one, a number and a label for a key moment, set in the editorial look below. Start from it and change what the moment needs; keep how it leaves room for its shadow.

```json
{
  "html": "<div class=\"set\"><div class=\"big\"></div><div class=\"label\"></div></div>",
  "css": "html, body { margin: 0; height: 100%; } body { box-sizing: border-box; padding: 10vh; display: flex; align-items: center; font-family: 'Inter Variable', sans-serif; } .set { text-shadow: 0 0.8vh 4vh rgba(0, 0, 0, 0.45); } .big { font-weight: 900; font-size: 50vh; line-height: 0.88; letter-spacing: -0.04em; color: var(--accent); } .label { margin-top: 4vh; font-weight: 700; font-size: 9vh; line-height: 1.15; letter-spacing: 0.16em; text-transform: uppercase; color: #fff; }",
  "js": "const big = document.querySelector('.big'); const label = document.querySelector('.label'); big.textContent = tscaps.params.big; label.textContent = tscaps.params.label; document.body.style.setProperty('--accent', tscaps.params.accent); const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4); tscaps.render = (t) => { const first = ease(t / 0.5); const second = ease((t - 0.12) / 0.5); big.style.opacity = String(first); big.style.transform = `translateY(${(1 - first) * 12}%)`; label.style.opacity = String(second); label.style.transform = `translateY(${(1 - second) * 20}%)`; };",
  "fields": [
    { "id": "big", "label": "Number", "kind": "text", "defaultValue": "87%" },
    { "id": "label", "label": "Label", "kind": "text", "defaultValue": "never read the manual" },
    { "id": "accent", "label": "Accent", "kind": "color", "defaultValue": "#ffd400" }
  ],
  "aspectRatio": 1.4,
  "box": { "kind": "box", "centerX": 0.25, "centerY": 0.35, "width": 0.4 }
}
```

The box goes where `render_frames` shows only background beside the speaker; the one above is an example.

## Look: editorial, not a web page

Set a graphic the way a magazine cover or a film title sets type over a picture. The picture is the background; the type sits on it.

- **Type only.** No plates, cards, panels, pills, boxes, badges, buttons, borders or filled backgrounds. Legibility comes from the type's size and weight, a soft shadow (`text-shadow: 0 2px 28px rgba(0,0,0,.5)`), and a calm part of the picture to sit on.
- **Contrast of scale:** one element very large (the number or the word that matters, about a fifth to a third of the frame's short side), the rest small (a label in capitals, letter-spacing 0.12 to 0.2em, or a short line in italic serif). Two sizes, far apart; never everything at one size.
- **Typefaces:** the large element in a heavy sans at 800 to 900 (Inter Variable, Montserrat Variable) or a condensed one (Anton, Bebas Neue, Oswald Variable), letter-spacing -0.02 to -0.04em, line-height about 0.9; an accent line may use a serif in italic (Fraunces Variable, EB Garamond Variable).
- **Colour:** white, and at most one word in one accent colour (the caption style's, when it has one). No gradients, glows or outlines.
- **Short:** the number, or one to four words, plus at most a short label. Cut words rather than shrink type.
- **Placed like a layout:** in empty space beside or above the speaker, aligned left or right to that space, not centred over the middle by habit. Look at the frame first (`render_frames`) and put the box where there is only background. **Never over the face**, nor over the captions.
- **Readable size:** nothing meant to be read under about 2.6% of the frame's short side (28px on a 1080x1920 frame). On a vertical frame keep it between 9% and 69% of the frame's height (the platform's own text and buttons sit below).
- **Room for the shadow.** The video shows nothing of the graphic outside its box, so a shadow that reaches the box's edge stops there in a straight line, which shows on the footage. Give `body` a padding on every side of at least twice the shadow's blur plus its offset, in the same unit (a `4vh` blur takes `10vh`), and make `aspectRatio` leave that room around the type.
- **No native-looking controls:** no bullets, list indents or default margins; draw any mark yourself (SVG or CSS shapes).

## Motion

- Entrances 0.3 to 0.6 s with a long-tailed ease-out (`1 - (1 - x)^4`). Exits 40 to 50% shorter than the entrance.
- Stagger words 60 to 120 ms apart, list items 40 to 80 ms.
- Once landed, stay still. No breathing, floating or pulsing loops. A graphic that keeps moving moves its content (a counter counting, a bar filling), not itself.
- No bounce. Opacity and colour never bounce. Type enters by rising a little and clearing (opacity and a short `translateY`), or a letter-spaced line tightening.
- Hold long enough to read: about 0.5 s plus 0.3 s per word from the moment it is readable.
- Animate `transform` and `opacity`.
- Timing to speech: a graphic's `t` starts when the shot it opens on starts. To make something happen when a word is said, read the word's time with `get_transcript` (`detail: timed`, over that stretch) and subtract that shot's start.

## The look of video, not of the web

Left to habit, a graphic comes out as a piece of a web page: a panel with a title, rows of a label and a value, a progress bar on its track. On a video that reads as a screenshot of a dashboard.

There are two kinds of graphic made for video, and they are not held to the same rules. Know which one you are writing.

- **A text graphic**: words and numbers in motion on the footage. The number being said, the claim, the name, the item of a list. It is what a short talking video takes most easily and what most moments call for: take it unless the moment needs the other.
- **A scene** (a motion graphic): a few seconds of animation drawn in code that take the frame, with a background of their own. As a b-roll, it shows the picture a sentence paints; in an explainer, how something works or where it is. It is not for a number or a line to keep.

### A text graphic

These rules hold whatever it says: hold every text graphic to all of them before placing it.

**What is on screen**

- **One thing at a time.** A page shows everything at once; a video shows what is being said now. Each element arrives on the word that says it, and what came before steps back (dimmed to under half), so the eye has one place to be.
- **One hero.** At any moment one element is the picture: the number or the word that matters, as large as its line allows, most of the width of its box. Nothing else is over a quarter of its size.
- **Three roles and no more:** the hero in the heavy face; an aside in the italic (who or what the hero is about); a label in small capitals, tracked wide (the topic, the source). At most four pieces of text on screen at once.
- **No furniture of an interface.** Nothing in the graphic has a background, a border or rounded corners: no panel, card, row, track, progress bar, axis, legend, bullet or icon. The only marks beside type are a hairline and, behind everything, the veil of the next rule. A number is shown by the number itself, counting to its value; a comparison by two heroes set alike, the later one in the accent.

**Where it sits**

- **A text graphic sits on the footage**, in one of two ways. In the captions' place, with the captions off and the face in view: the way to prefer, for a hero and what goes with it. Or over the whole frame with the footage dimmed behind (a veil of 0.8 or more on `body`), when there is more to read than fits there: that reads as a title card. Never a panel with an edge over part of the picture.
- **One axis.** Everything is aligned to one left edge, or centred on the captions' axis. Not some of each.

**How it is set**

- **Kin of the captions:** the caption template's heavy face for the hero, its italic for the aside, its one accent for the one thing that matters most, white for the rest, and white under half strength for what has stepped back. No other colour.
- **Set like print:** large type tracked tight (-0.05em or more), with tabular figures where it counts; a unit (%, $, k) small and raised beside its number, about 0.4 of its size; capitals tracked 0.16em or more; lines kept short.

**How it moves**

- **Each element comes in once, on its word**, by what it is: a hero rises from behind a line, and a number counts up to land on the word that says it; a hero that replaces another rolls in as the other rolls out; an aside rises a little and clears; a label fades in, a hairline draws itself. 0.3 to 0.6 s, easing out. Then it is still.
- **Every time in the code is a word's time**: read the words' times (`get_transcript` with `detail: "timed"`) and subtract the start of the shot the graphic opens on. Nothing is timed by eye.

**The test.** Describe the landed frame in one sentence. If the sentence needs the word panel, card, row, bar, list or chart, it is a web page: write it again.

### A scene

A scene has a background of its own, since it is a picture in place of the footage and not type over it (*Over the video, or in place of it*, above). It has a guide of its own, `scenes`: what to draw from a sentence, four styles of drawing and moving, how to compose it over the captions, and how to look at it across its time. Read it before drawing one. A scene that explains (how something works, where a place is) is built up with the voice, part by part, by the same guide.

### Moves, for a text graphic

As code, so each graphic need not rediscover them (`out` eases a 0 to 1 progress; `k` is one):

| Move | How |
|---|---|
| Easing out | `const out = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 4)` |
| Counting, landing on a word said at `at` | text is `Math.round(value * out((t - (at - d)) / d))`, with `d` the seconds it counts for |
| Rising from behind a line | a wrapper with `overflow: hidden` and padding for the glyphs; the child at `translateY((1 - k) * 125%)` |
| Rolling to replace | both stacked in a window one line high, `overflow: hidden`; the stack at `translateY(-k * lineHeight)` |
| Stepping back | `opacity: 1 - k * 0.55` |
| A unit beside a number | `font-size: 0.4em; vertical-align: top; margin-top: 0.36em` |
| A hairline drawing | `transform: scaleX(k); transform-origin: left` |
| An SVG line drawing | `stroke-dasharray: length; stroke-dashoffset: (1 - k) * length` |

A rise from behind a line hides on purpose what it has not let in yet, and `add_graphic` reports that text as cut. That warning is about the mask and can stand; text cut once everything has landed cannot.

## Check it before you answer

1. Read the warnings `add_graphic` or `edit_graphic` answered: the code threw, the graphic drew nothing, or, once landed, its text is cut by its box or under the size that reads on a phone. Fix those first.
2. `render_frames` at a few moments of the shot (the start of the entrance, mid-entrance, landed, late) to see it over the video, with the captions; add `region` around the graphic to read its text, and look at the box's edges: a straight line where the shadow stops means too little padding.
3. Fix what breaks the read first (unreadable, clipped, empty, an error), then timing, then polish.
