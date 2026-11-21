# Style controls

How a knob in the editor reaches your CSS. Two families: the **universal** typography
controls every template gets for free, and the **style controls** a template declares for
itself.

Both arrive the same way — as a `--tscaps-<id>` custom property on the caption wrapper, read
with `var(--tscaps-<id>, <fallback>)`. A variable your stylesheet never reads is a control
that renders, accepts clicks, and does nothing.

Guide: [../AUTHORING.md](../AUTHORING.md) · Schema: [template-json.md](template-json.md)

---

## The universal set

The font picker, size slider, bold and italic toggles, alignment, case and spacing controls.
Every template is expected to read every one of these.

| Variable | Read on | Driven by | Typical fallback |
|---|---|---|---|
| `--tscaps-font-family` | `.segment` | font autocomplete | the template's signature font |
| `--tscaps-font-size` | `.segment` | size slider | natural size in `cqh` (2 to 6 covers most templates at the 720×1280 reference) |
| `--tscaps-font-weight` | `.segment` | bold toggle | `normal`, or the template's natural weight |
| `--tscaps-font-style` | `.segment` | italic toggle | `normal`, or `italic` for a template that starts italic |
| `--tscaps-letter-spacing` | `.segment` | letter-spacing slider | `0em`, or the template's natural value |
| `--tscaps-word-spacing` | `.word` as `margin`, or the flex container as `gap` | word-spacing slider | the template's natural inter-word gap in `em` |
| `--tscaps-line-spacing` | `.line + .line` as `margin-top`, or the flex container as `gap` | line-spacing slider | the template's natural inter-line gap in `em` |
| `--tscaps-text-align` | `.segment` | alignment control | `center` |
| `--tscaps-text-transform` | `.segment` | case control | `none`, or `uppercase` for a template that wants caps |
| `--tscaps-text-decoration` | `.word` | underline / strikethrough toggles | `none` |
| `--tscaps-rotation` | `.segment` as `rotate` or `transform` | rotation slider | `0deg` |
| `--tscaps-primary-color` | `.segment` | the main colour picker | the template's text colour |

Three placements are not free choices:

- **Spacing is margin, not `word-spacing` or `line-height`.** Words and lines are adjacent
  `<span>` / `<div>` elements with no whitespace between them, so the natural primitive for
  the space *between* two atoms is margin. It also keeps a double-dial problem out of
  background templates: with `line-height`, sliding it up grows the pill height *and* the gap
  between pills at once. With a `margin-top` on adjacent lines, the pill height is fixed by
  the template's own `line-height` and the gap is its own knob. Same logic for word spacing
  versus a per-word background's padding: padding is the pill size, margin is the gap.
- **`text-decoration` lives on `.word`.** It does not propagate reliably through
  `display: inline-block` descendants, and most templates wrap each word in one.
- **`line-height` is not a universal.** Each template hardcodes its own, typically 1.0 to 1.6,
  as part of its identity. There is no `--tscaps-line-height`.
- **Its unit answers a question, and the two answers are both right somewhere.** Unitless
  inherits as a ratio, so a descendant recomputes the leading against its own size; a length
  (`0.92em`) resolves on `.segment` and inherits as that fixed length, so a descendant of any
  size keeps it. They are identical until something below `.segment` changes size — a per-tag
  face, a big last word, or the per-word size the editor lets a user set on any template. Ask
  whether that size change is **real** or **optical**: milo and luca genuinely enlarge a word
  and want its row to grow, so they stay unitless and override the leading on that element;
  enzo scales its serif only to match the grotesque's x-height, so a line holding one must not
  open up, and it uses `em`. The per-word override is a real change in every template, which is
  why unitless is the default and a length is the exception that earns itself.

`--tscaps-rotation` is always emitted but reading it is optional: a template that omits the
var simply ignores the rotation slider, and the loader's missing-var warning does not fire for
it.

`--tscaps-text-align` arrives already resolved to `left` / `center` / `right`, which is what a
template must consume. Lines are pinned to `direction: ltr`, so CSS would resolve
`text-align: start` against that pin and always answer "left". The physical value also drops
straight into `justify-content` for a template laying its line out with flexbox. Which
vocabulary to *declare* it in is in [template-json.md](template-json.md#placement-in-the-frame).

**A quicker way to read all of this** is the `segment-typography` mixin, which emits the whole
block from your own defaults. See [library.md](library.md#segment-typography).

## Unit conventions

The caption overlay declares `container-type: size` on its root, so inside a template's CSS:

- **`cqh`** (1% of video height) is the unit for font size and other vertical-scale
  dimensions. This follows the broadcast convention — a subtitle occupies 1/30 to 1/20 of
  vertical space — so a 16:9 horizontal renders the same template more discreetly than a 9:16
  vertical of the same physical resolution, matching the TV-versus-shorts reading. Calibrate
  against a 720×1280 vertical, where `1cqh ≈ 12.8px`.
- **`cqw`** (1% of video width) is for horizontal chrome that should track the video's width,
  such as a fixed-width window frame. Same reference, where `1cqw ≈ 7.2px`.
- **`em`** is for everything that should track the text size: padding, spacing, background
  radius, shadow offsets and blurs, transforms in keyframes, outline thickness. When the user
  nudges font size, these follow with no retuning.
- **`px`** is reserved for true hairlines, and even then see
  [rendering.md](rendering.md#subpixel-rendering) first.

Never hardcode a font-driven dimension in `px`. It will not scale with video size or font
size, and it will be out of proportion on any video other than the one you authored on.

## Declaring a control of your own

Anything past the universal set is a style control. There are **three routes**, and picking
the wrong one fails the contract check.

### 1. A primitive declares it for you

`soft-drop-shadow`, `dynamic-font-size`, `typewriter` and the animation recipes each declare
the controls they read. Using the primitive is the whole transaction:

```scss
@use '../_lib/soft-drop-shadow' as *;

.word {
  text-shadow: soft-drop-shadow(0.08, 0.4);  // and you now have three shadow sliders
}
```

Do **not** also list those ids in `styleControls`. The template would ship two controls
writing one variable, and the contract check rejects it. To see what a template ends up with,
read its generated `controls.build.json`.

### 2. Shorthand for a catalogued id

When the id is one the catalogue describes but no shared primitive reads it in your case — a
value your `filters.svg` reads, say — declare it with the id and the default alone:

```jsonc
{ "id": "filter-shadow-distance", "default": 0.04 },
{ "id": "filter-shadow-blur",     "default": 0.04 }
```

Type, unit, group and bounds come from the catalogue; you own the default, because the
default is your look. `label` and `legend` come from the catalogue as a default but the entry
may override them where your template puts the concept in a contextual role — a chat bubble's
radius reading "Bubble radius" instead of "Background radius", a second colour line reading
"Top text" instead of "Text". Redeclaring anything else fails the check.

### 3. Full declaration in `template.json`

When the control is yours alone: a mask offset, a window colour, a pill radius no shared
primitive knows about and no catalogue entry covers. The full shape is in
[template-json.md](template-json.md#style-controls).

**Declare the bounds.** A numeric control that omits `min` / `max` / `step` silently inherits
`0 / 100 / 0.1` from the field renderer, which makes a nonsense dial out of a value whose
useful range ends at `0.2`.

If a control you need is one another template already has, it belongs in the catalogue rather
than in your JSON. Adding it there is one entry in `StyleControlCatalog`.

## Who owns what

| | Owner |
|---|---|
| `type`, `unit`, `group`, `subgroup`, `min` / `max` / `step`, `valueOn` / `valueOff`, `options` | the **concept** |
| `label`, `legend` | the **concept by default, the template may override** |
| `default`, and whether the control is offered at all | the **template** |

The split is load-bearing rather than tidy. What the concept owns cannot be redeclared, so two
templates cannot make the same slider behave differently. A template that genuinely needs
different bounds is describing a **different concept** and owes it a different id — a CSS blur
radius and a Gaussian standard deviation are not one control with two ranges, which is why
`shadow-blur` and `filter-shadow-blur` are separate entries.

**Bounds are a judgement, and each one wants an argument.** The dataset of what templates
already pass gives a centre, not edges. Write the reasoning down when you add one.

### One word for the words the speaker leans on

Three tags mark them — `emphasis`, `accent`, `entity` — and a template styles them as one
family, through `.emphasis, .accent, .entity`. The controls over that family read **accent**
to the user: `Accent`, `Accent font`, `Accent weight`, `Bold accents`. Never "tag" or
"tagged" — the marks often arrive on their own rather than by hand, so that word names a
mechanism the user never met.

The **ids** stay `tag-*`. They name that mechanism — every tag class the rule reaches — and
`accent-color` is already taken on another template for something unrelated.

A template that treats one part of the family differently names that part instead of the
family. cleo puts weight on `.emphasis` alone and italics on the other two, so its labels read
`Emphasis weight` and `Italic accents`, and the contrast between them is what tells the user
the two controls reach different words.

That split works on the ids too, and there it is only forced when the parts move the **same**
property. cleo's two reach different halves of the family and are still `tag-weight` and
`tag-italic`, because the property already tells them apart. Two colours cannot both be
`tag-color`, so the one over the smaller part carries it: `tag-lift-color` beside
`tag-color`. Name the part, not "the other one" — a second colour called `tag-color-b` says
nothing about which words change when it moves.

## Groups and subgroups

`group` names the panel; `subgroup` names the section inside it.

| Group | Subgroups |
|---|---|
| `style` | `colors`, `appearance`, `assets` |
| `motion` | `segments`, `words`, `emojis` |

A `motion` control renders beside the animation it moves rather than in the Style tab, so a
user looking for how the captions move finds it where the movement is. Use it for a rise
distance in your own keyframes, how far a pill overshoots, how fast a sheen sweeps.

**The test is whether the value means anything while nothing is moving.** A colour a narrated
word takes is read by its resting state too, so it belongs in `style` even though an animation
interpolates towards it. A duration or an overshoot is meaningless standing still, so it
belongs in `motion`.

The contract check refuses an unknown group, an unknown subgroup, a subgroup with no group,
and a pair from two different rows (`style` + `words`).

**Give a bespoke animation a duration control before you widen its distance.** At 24 to 30 fps
a 0.16s pop is four frames and its peak renders on roughly one of them, so no amount of extra
scale is legible in a single frame. `s` is a unit here for exactly this.

## What the build refuses

Each of these has been mutation-tested. Re-prove any you change.

| Mistake | Result |
|---|---|
| an id the catalogue does not describe, passed to `control.field` | build error naming the file to add it to, with a did-you-mean when one is close |
| the same control declared twice with different defaults | build error naming both values |
| a default carrying a unit | build error — the unit comes from the concept |
| a control declared both by hand and by a primitive | contract violation; before the rule it shipped two sliders writing one variable, in silence |
| a `template.json` entry redeclaring a concept-owned field for a catalogued id | contract violation naming each offending field |
| a `var(--tscaps-*)` read of a control the template does not ship | contract violation |
| a variant overriding a key no control answers to | contract violation |

## Where this does not reach

Editing built CSS in the editor's Code tab cannot declare a control, and neither can an agent
writing a template's CSS. Both can read and use the controls a primitive declares; adding a
new one is an edit to `template.json` or to the catalogue.

When a user's own edit disconnects a control — deleting the `var()` a slider was feeding — the
editor notices and dims that control with "Your CSS controls this" rather than leaving a knob
that silently does nothing.
