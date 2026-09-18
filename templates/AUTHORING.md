# Authoring a template

A template is a caption look: a typeface, a palette, a way of marking the word being
spoken, a way of arriving on screen, and the set of knobs the editor offers while it is
active. This guide builds one from nothing, a step at a time. Each step is small and
runnable; the deep reference for each lives in [`_docs/`](_docs) and is linked where it
becomes relevant.

Read this front to back once. You will have written a working template by the end of
step 4, and steps 5 to 8 are the parts you add when you need them.

- **New to the gallery?** Start here.
- **Looking up a field, a variable, a rule?** Go straight to [`_docs/`](_docs) — the map is
  in [step 8](#step-8--where-to-go-next).
- **About to open a PR?** [`_docs/checklist.md`](_docs/checklist.md).

---

## Three facts to hold first

Everything below follows from these, and getting one wrong produces a bug that looks like
something else.

**1. The runtime reads flat, standard CSS.** You author `style.scss`, the build compiles it
to `style.build.css`, and that flat file is what renders, what the user sees in the editor's
Code tab, and what a saved project stores. Sass exists at authoring time only. Nothing
resolves at runtime.

**2. Every animation is paused.** The renderer pins `animation-play-state: paused` and
`animation-fill-mode: both` on every caption element, and moves the playhead by rewriting
`animation-delay` each frame. An animation with no playhead-anchored delay holds its first
frame forever, which reads exactly like CSS that was ignored. `transition` cannot work at
all — there is no previous frame for it to interpolate from.

**3. The editor drives your CSS through variables.** Every control the user touches becomes
a `--tscaps-<id>` custom property. A variable your stylesheet never reads is a control that
renders, accepts clicks, and does nothing.

---

## Step 1 — the smallest template that renders

Two files in a folder. The folder name is the template's id.

```
templates/aria/
├── template.json
└── style.scss
```

`template.json` needs exactly one field:

```json
{ "name": "Aria" }
```

Everything else falls back to a system default: the default font and size, no rotation,
bottom-centred alignment, the default splitter pipeline, every effect off.

`style.scss` paints the captions. The engine renders one caption at a time as a tree of
three elements, and your selectors are their classes:

```html
<div class="segment">
  <div class="line">
    <span class="word">Hello</span>
    <span class="word">world</span>
  </div>
</div>
```

So the smallest useful stylesheet is:

```scss
.segment {
  font-family: 'Inter';
  font-size: 3cqh;
  color: #ffffff;
  text-align: center;
  line-height: 1.2;
}

.line {
  display: block;
}

.word {
  display: inline-block;
  margin: 0 0.1em;
}
```

Two unit rules, and they are not stylistic preferences:

- **`cqh` for font size.** The caption overlay declares `container-type: size`, so `1cqh` is
  1% of the video's height. A 16:9 horizontal then renders the same template more discreetly
  than a 9:16 vertical, which is the broadcast convention and the one users expect. Calibrate
  against a 720×1280 vertical, where `1cqh ≈ 12.8px`.
- **`em` for everything that should track the text.** Padding, shadow offsets, outline
  thickness, transforms in keyframes. When the user drags the size slider, these follow.
  Never `px` for any of them: a `1px` shadow that reads sharp at 480p disappears at 1080p.

That renders. It is not yet a template, because none of the editor's controls reach it.

→ [`_docs/css-contract.md`](_docs/css-contract.md) for the full element tree, letter mode,
and what right-to-left text does to `:first-child`.

---

## Step 2 — let the editor's controls reach it

The font picker, size slider, bold and italic toggles, alignment and case buttons all work
by writing `--tscaps-*` variables onto the caption. Read each one with your template's own
value as the fallback, and the control starts working:

```scss
.segment {
  font-family: var(--tscaps-font-family, 'Inter');
  font-weight: var(--tscaps-font-weight, 700);
  font-style: var(--tscaps-font-style, normal);
  font-size: var(--tscaps-font-size, 3cqh);
  letter-spacing: var(--tscaps-letter-spacing, 0em);
  text-align: var(--tscaps-text-align, center);
  text-transform: var(--tscaps-text-transform, none);
  color: var(--tscaps-primary-color, #ffffff);
  line-height: 1.2;
  rotate: var(--tscaps-rotation, 0deg);
}

.line + .line {
  margin-top: var(--tscaps-line-spacing, 0em);
}

.word {
  display: inline-block;
  margin: 0 var(--tscaps-word-spacing, 0.1em);
  text-decoration: var(--tscaps-text-decoration, none);
}
```

The fallback is what renders when the user has not touched the control, so it should be your
template's natural value — `700` for a template whose identity is heavy weight, not
`normal`.

Three placements are not free choices:

- **`--tscaps-word-spacing` is a `margin` on `.word`**, not `word-spacing`. Words are
  adjacent `<span>`s with no whitespace between them, so the natural primitive for the gap
  between two of them is margin. The same reason puts `--tscaps-line-spacing` on
  `.line + .line` as `margin-top`.
- **`--tscaps-text-decoration` lives on `.word`**, not `.segment`. It does not propagate
  reliably through `display: inline-block` descendants.
- **`line-height` is yours, hardcoded.** There is no `--tscaps-line-height`; leading is part
  of a template's identity, not a user knob.

Give the template its own defaults for these in `template.json` so the editor's sliders start
where the design does:

```json
{
  "name": "Aria",
  "category": "classic",
  "typography": {
    "fontStack": "inter",
    "fontWeight": 700,
    "fontSize": 3,
    "wordSpacing": 0.1
  },
  "alignment": { "verticalAlign": "top", "verticalOffset": 0.86 }
}
```

→ [`_docs/style-controls.md`](_docs/style-controls.md) for the full variable table and the
`start` / `end` vs `left` / `right` question.
→ [`_docs/template-json.md`](_docs/template-json.md) for every field of `template.json`.

---

## Step 3 — mark the word being spoken

Every frame, the engine attaches exactly one state class to each `.word` and each `.line`:

| Class | When |
|---|---|
| `word-not-narrated-yet` | the playhead is before the word |
| `word-being-narrated` | the playhead is inside it |
| `word-already-narrated` | the playhead has passed it |

Same three for `.line`. So the karaoke highlight is one rule:

```scss
.word-being-narrated {
  color: var(--tscaps-highlight-color, #ffdd00);
}
```

**A state class must never change the element's size.** `font-weight`, `font-size`,
`letter-spacing`, `padding`, `margin` and `font-family` all feed layout, so the word takes a
new width the instant the playhead reaches it and every word after it on the line jumps
sideways. Once per word, for the whole line. Mark the state with `color`, `background`,
`text-shadow`, an absolutely-positioned `::before`, or `transform` — which paints without
reflowing.

A weight change looks safe under a monospace face, where every weight is the same width. It
is not: `font-family` is one of the user's controls, and the moment they pick a proportional
family the line starts jumping.

---

## Step 4 — make it move

An animation belongs on the structural element (`.segment`, `.word`), not on a state class,
and its `animation-delay` comes from the engine's clock:

```scss
.segment {
  animation: aria-rise 0.32s var(--on-segment-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes aria-rise {
  from { opacity: 0; transform: translateY(0.2em); }
  to   { opacity: 1; transform: translateY(0); }
}
```

`--on-segment-starts` is the number of seconds until the segment starts, negative once it
has. Feeding it to `animation-delay` under a paused animation is what makes the frozen frame
walk the timeline as the playhead advances. There is one such variable per state:
`--on-word-being-narrated-starts`, `--on-line-already-narrated-ends`, and so on, plus a
`--<state>-duration` for each.

Two traps, both silent:

- **`from` must match the element's resting style.** With `both`, a paused animation paints
  its `from` keyframe from the moment the caption mounts, even when its window opens later.
  Write `from { color: red }` over a white base and every word renders red until its turn.
- **Never put two animations on one element.** The second one's `from` wins the cascade for
  both, so the element is locked into it from mount. Collapse to one animation covering the
  whole cycle.

Then declare what you applied, so the editor can show the user what is running:

```scss
@use '../_lib/animation/declared';

.segment {
  @include declared.animation('aria-rise', 'segment');
  animation: aria-rise 0.32s var(--on-segment-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

Without it the Motion tab reads "None" over a caption that visibly moves, and the contract
check fails naming the unclaimed `@keyframes`.

→ [`_docs/animation.md`](_docs/animation.md) for the four patterns, per-letter timing, the
library of ready-made animations, and why the paused model is what it is.

---

## Step 5 — add a knob of your own

Anything past the universal set is a **style control**: an entry that becomes
`--tscaps-<id>` on the caption, which your CSS reads. Declare it in `template.json`:

```json
"styleControls": [
  { "id": "primary-color",   "label": "Text",        "type": "color", "default": "#ffffff", "group": "style", "subgroup": "colors" },
  { "id": "highlight-color", "label": "Active word", "type": "color", "default": "#ffdd00", "group": "style", "subgroup": "colors" },
  { "id": "plate-radius",    "label": "Plate radius", "type": "float", "default": 0.2,
    "min": 0, "max": 1, "step": 0.02, "unit": "em", "group": "style", "subgroup": "appearance" }
]
```

**Always declare the bounds of a numeric control.** A control that omits `min` / `max` /
`step` silently inherits `0 / 100 / 0.1`, which makes a nonsense dial out of a value whose
useful range ends at `0.2`.

**A control that is only about movement goes in the Motion tab** — `"group": "motion"` plus
the kind it moves as its subgroup (`segments`, `words`, `emojis`). It renders beside the
animation it drives instead of among the colours. The test is whether the value means
anything while nothing is moving: a colour a narrated word settles on is read at rest too, so
it is `style`; a duration or an overshoot is meaningless standing still, so it is `motion`.

**Some ids are catalogued**, meaning the concept's label, type, unit and bounds are already
settled and shared across the gallery. For those, write only the id and your default:

```json
{ "id": "shadow-color", "default": "#000000" }
```

Redeclaring anything the concept owns fails the contract check. That is the whole point:
two templates cannot make the same slider behave differently.

→ [`_docs/style-controls.md`](_docs/style-controls.md) for the three declaration routes, the
catalogue, and what the build refuses.

---

## Step 6 — reuse what the library already solved

`templates/_lib/` holds Sass primitives every template can call. They are not a closed set
you must stay inside: a template that needs its own animation, filter or control writes it,
and that is a first-class outcome. But reaching for a primitive is how you avoid re-deriving
a solved problem, and it is what gives the editor something to offer the user.

The whole of step 2's `.segment` and `.word` blocks are one mixin each:

```scss
@use '../_lib/segment-typography' as *;
@use '../_lib/word-layout' as *;

.segment {
  @include segment-typography(
    $font-family: 'Inter',
    $font-size: 3cqh,
    $font-weight: 700,
    $line-height: 1.2,
  );
}

.word {
  @include word-layout(0.1em);
}
```

And step 4's animation is one of fifteen recipes:

```scss
@use '../_lib/animation/rise-in' as *;

.segment {
  @include rise-in($element: 'segment', $distance: 0.2em, $delay: var(--on-segment-starts));
}
```

That recipe carries the declaration, the keyframes, and the fields the user drags in the
Motion tab. Some primitives also bring their controls with them — `soft-drop-shadow(0.08,
0.4)` yields the shadow *and* its three sliders, and you must not list those ids in
`styleControls` as well.

**The build compiles it.** `pnpm templates:build` runs Sass over
every template, writes `style.build.css` beside the source, and that flat file is what the
runtime reads. It also runs on install and in CI. The build artifacts (`style.build.css`,
`filters.build.svg`, `controls.build.json`, `animations.build.json`) are gitignored — never
edit them, never commit them.

A template that uses no primitive at all may stay as plain `style.css`; the build passes it
through. Every template in the gallery uses at least one, so `style.scss` is the normal case.

→ [`_docs/library.md`](_docs/library.md) for every primitive and its signature.

---

## Step 7 — register it and check it

A folder is not enough. Add the folder name to `builtinTemplateNames()` in
[`apps/studio/src/bootstrap/wiring/templates.ts`](../apps/studio/src/bootstrap/wiring/templates.ts).
List order is gallery order, and the first entry is the fallback when a saved project names a
template that no longer exists.

Then run the two checks:

```bash
pnpm templates:build      # compile
pnpm templates:contract   # validate
```

The contract check reads the *built* CSS and reports, among others: a `var(--tscaps-*)` that
names nothing, an `animation` referencing keyframes nothing defines, an animation applied
without `declared.animation`, an `asset:` token that resolves to no file, a filter id that no
document defines, a control declared twice, a control declared with metadata its concept owns,
and an `!important` anywhere in the stylesheet.

That last one deserves its own sentence. **`!important` in a template stylesheet is not a
strong rule, it is an unreachable one.** Cascade layers reverse for `!important`, and the
template's layer is declared before the per-element one, so an important declaration here
beats every per-element customisation the editor can produce — the CSS a user writes for one
word, the colour picker, the size slider. The panel silently stops doing anything and reads as
a broken editor. Raise the selector instead.

The same checks run live in the editor's Code tab, so a user editing your template's CSS sees
the same messages you do.

---

## Step 8 — where to go next

The guide stops here. Each reference below is self-contained; open the one you need.

| Read | For |
|---|---|
| [`_docs/template-json.md`](_docs/template-json.md) | Every field of `template.json`: splitters, line splitter, effects, variants, features, rendering switches, behind-actor |
| [`_docs/css-contract.md`](_docs/css-contract.md) | Everything the runtime publishes to CSS: element tree, state classes, structure tags, timing variables, structural metadata, letter mode, right-to-left, addressing one element, shared assets |
| [`_docs/style-controls.md`](_docs/style-controls.md) | The universal typography variables, your own controls, the catalogue, groups and subgroups, what the build refuses |
| [`_docs/animation.md`](_docs/animation.md) | The paused model, the four animation patterns, the library of fifteen recipes, declaring what you apply, the entrances a user can pick, per-animation controls |
| [`_docs/library.md`](_docs/library.md) | The Sass build and every primitive: `segment-typography`, `word-layout`, `soft-drop-shadow`, `dynamic-font-size`, `control.field`, the filter recipes |
| [`_docs/filters.md`](_docs/filters.md) | `filters.svg`: file shape, filter regions, variable substitution, recipes, what SMIL cannot do, cross-browser notes |
| [`_docs/rendering.md`](_docs/rendering.md) | Where preview and export differ, the video-frame layer, text behind the actor, how the line splitter measures |
| [`_docs/checklist.md`](_docs/checklist.md) | Everything to verify before opening a PR |

Three templates worth reading end to end, in order of difficulty:

- [`juno/`](juno) — the shape every template has. Typography, a shadow stack scaled by a
  control, one entrance, one state-class rule.
- [`kai/`](kai) — the same plus an SVG filter for chromatic aberration on the active word,
  and how a style control reaches the filter scope.
- [`pico/`](pico) — letter mode: each letter revealing at its own moment inside the word's
  narration window, with a caret riding along.
