# Animation

Animation is the part of template authoring where the rules are not interchangeable. Pick the
pattern that matches what you are animating; the wrong pick produces visible bugs in either
the live preview or the export.

Guide: [../AUTHORING.md](../AUTHORING.md) · Library: [library.md](library.md) ·
Clock variables: [css-contract.md](css-contract.md#timing-variables)

---

## The frozen-frame model

The renderer — both the live overlay and the export pipeline — injects
`animation-play-state: paused` and `animation-fill-mode: both` on every segment, line, word,
letter and decoration. Animations do not run on their own wall clock. Their visible state is
decided entirely by two things:

1. `animation-delay`, driven by a CSS variable
2. the keyframe percentages

When the playhead moves, the engine writes new values to the timing variables, the browser
re-resolves the paused animations, and the new frozen frame renders. The export does the same
in a fresh SVG per frame.

**Both longhands are framework-owned and a template cannot change them.** They arrive as one
`!important` rule covering every element and pseudo-element in the caption subtree, so a
`forwards` / `backwards` / `none` keyword written into an `animation:` shorthand is inert.
They are not knobs because the shorthand resets every longhand it omits: as overridable
defaults they would apply or not depending on whether a rule happened to use the shorthand,
and the frozen-frame contract cannot depend on that. Nothing is lost — `from` and `to` are
yours, so any before- or after-phase you want is expressible as a keyframe.

**Spell `both` out in every `animation:` shorthand anyway.** A shorthand with no fill keyword
reads as `none` and misleads the next reader exactly as much as a wrong keyword would. A
template that sets the longhands one by one simply never mentions `animation-fill-mode`.

**This is also why `transition` does not work.** Transitions interpolate in real time between
observed property changes. They cannot be paused and re-anchored to the playhead, and the
export renders each frame as an isolated SVG with no previous frame to interpolate from. For a
smooth colour or transform change, use a keyframe animation.

## Two traps, both silent

### `from` must match the element's resting style

With `both`, a paused animation paints its `from` keyframe from the moment the element mounts,
even when its real timeline window opens much later. Write `from { color: red }` over a white
base and every word in the caption renders red from mount until its narration begins.

### Never put two animations on one element

The natural-looking way to write "fade in then fade out" is one animation per direction:

```scss
/* DON'T */
.word {
  animation:
    tscaps-fade-in  0.4s var(--on-word-being-narrated-starts)   ease both,
    tscaps-fade-out 0.4s var(--on-word-already-narrated-starts) ease both;
}
```

While the second animation has a positive delay it is paused in its before-phase, and a paused
before-phase animation still contributes its first keyframe to the cascade. With two on one
element, the **second one's `from` wins**, so the element is locked into it from mount. In the
case above that is the highlighted state: every word renders highlighted, including words that
are not yet being narrated.

Collapse to one animation covering the whole cycle — pattern B below.

## The four patterns

> **Anchor animations on `.segment` / `.line` / `.word`, not on the state classes.** The
> structural elements live for the whole caption; the state classes flip mid-life. Patterns A
> and B are the recommended path. Pattern C has a real use but rarely beats them.

### Pattern A — on the element, anchored to a state's start

For an animation that fires when an element enters a state and may continue past it.

```scss
.word {
  /* base = visually identical to the animation's `from` */
  opacity: 0;
  transform: translateY(0.3em);
  animation: tscaps-word-enter 0.32s var(--on-word-being-narrated-starts) ease both;
}

@keyframes tscaps-word-enter {
  from { opacity: 0; transform: translateY(0.3em); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Declared on `.word`, not on `.word-being-narrated`: state classes flip at state boundaries,
`.word` is stable for the element's lifetime, and the animation runs to completion regardless
of how long the state lasts.

The negative delay positions the animation so its origin sits at the word's narration start.
Combined with the paused state, the visible frame at any time is exactly what the animation
looks like at `(playhead − word.start)` seconds from its origin.

### Pattern B — one animation spanning the whole state

For a fade in, hold, fade out cycle that must complete inside a state of unknown duration.
The typical karaoke highlight.

```scss
.word {
  animation:
    tscaps-highlight-cycle
    var(--word-being-narrated-duration)      /* dynamic duration */
    var(--on-word-being-narrated-starts)
    ease-in-out both;
}

@keyframes tscaps-highlight-cycle {
  0%, 100% { color: var(--tscaps-primary-color, #fff); }
  20%, 80% { color: var(--tscaps-highlight-color, #f5c982); }
}
```

`0%` and `100%` match the `.word` base state, so the pre- and post-active phases are visually
identical to it: no flash, no snap.

The fade-in / hold / fade-out proportion is fixed in the percentages, so the actual fade-in
time scales with the word's narration time — 100ms for a half-second word, 400ms for a
two-second one. That is a deliberate trade. A constant fade-in regardless of word length needs
a different pattern.

### Pattern C — on a state class

For when you specifically want the rule to **disappear** at the state's end, so the element
reverts to its `.word` base without a returning keyframe.

```scss
.word-being-narrated {
  animation:
    tscaps-pulse
    var(--word-being-narrated-duration)
    var(--on-word-being-narrated-starts)
    ease both;
}
```

**The delay is still required**, even though the class is added exactly at the state's start.
The intuition that the class itself triggers the animation at the right moment holds in a wall
clock system; here every animation is paused, so with no delay the frozen frame is frame 0
forever.

In practice pattern A with a returning keyframe achieves the same clean revert and is more
discoverable. Reach for C only when the post-state cleanup is so trivial that writing it as a
returning keyframe feels like noise.

### Pattern D — per-letter timing

Only under [letter mode](css-contract.md#letter-mode). Declare the animation on `.letter` with
a `calc()` that slices the word's narration window into `--letter-count` equal pieces and
offsets each letter by `--letter-index`:

```scss
.letter {
  animation:
    tscaps-typewriter 0.06s
    calc(
      var(--on-word-being-narrated-starts)
      + var(--word-being-narrated-duration) * var(--letter-index) / var(--letter-count)
    )
    ease-out both;
}
```

The resolved delay lands at `(word.start + word.duration * i / N) − currentTime`: the moment
the playhead reaches that letter's slice. This four-variable expression is canonical — every
letter-mode template uses the same one and changes only the keyframes.

**Letter mode forces a redraw every frame.** The frame renderer fingerprints each animation by
its resolved `animation-delay` to work out which variable it depends on, and this `calc()`
mixes four of them into a number that decodes to nothing the fingerprint recognises. Any
letter-mode segment is therefore treated pessimistically as continuously animating. Templates
that opt in accept that cost; word-level templates pay nothing.

## Declaring what you apply

**Every animation a template applies is declared, its own hand-written ones included.**

```scss
@use '../_lib/animation/declared';

.segment {
  @include declared.animation('glitch-flicker', 'segment');
  animation: tscaps-glitch-flicker 2s var(--on-segment-starts) steps(2) both;
}
```

Without it the editor cannot tell "this template moves nothing here" from "nothing was
recorded", and the Motion tab shows None over a caption that visibly moves. The contract check
enforces it: every `@keyframes` the compiled stylesheet animates with has to be claimed, or
`templates:contract` fails naming the block.

`@include declared.animation($id, $element, $values, $keyframes)`:

- **`$element`** takes `'segment'`, `'line'`, `'word'`, `'letter'` or `'decoration'`, and the
  build refuses anything else. **Name the element the rule actually addresses**, which is not
  always the one whose clock it reads: an `@include` inside `.line:last-child` is `'line'`
  even when its delay reads the segment's clock. This is what puts the animation's fields
  under the right section of the Motion tab, and — because a tuned value is a declaration on
  that kind of element, and an element's own declaration beats an inherited one whatever
  cascade layer it came from — it is what makes those fields reach the animation at all.
- **`$values`** is a map from custom property to value. It is the only place either is
  written: the declarations are emitted from it, so a property cannot be recorded under one
  name and declared under another. Values cross structured — a number keeps its unit, anything
  that is not a literal stays whatever it is — which is what lets a dial over one be seeded
  without reading any CSS back.
- **`$keyframes`** defaults to `tscaps-<id>`. Pass it where one animation is made of more than
  one block, as `typewriter` does for its letter reveal and its caret.

Library recipes call `declared.animation` for you. You only write it for keyframes of your own.

## A look that lives only in keyframes disappears when the animation is replaced

The animation slot on a caption and on its words belongs to the **user**. Picking an entrance
writes `animation-*` on that element, and whatever the template had there stops running.
Everything those keyframes were declaring goes with it, including things that were never
motion.

```scss
/* DON'T — the outline is only ever declared inside the keyframes */
.segment {
  animation-name: tscaps-glitch-flicker;
}
@keyframes tscaps-glitch-flicker {
  0%, 4%    { filter: url(#glitch-outline) url(#glitch); }
  14%, 100% { filter: url(#glitch-outline); }
}
```

The moment a user gives that caption an entrance, the text loses its outline. A permanent part
of the design, gone because it was carried by something temporary.

**Declare the permanent look as a normal declaration too**, and keep it chained in the
keyframes as well, since a keyframe replaces the property whole rather than adding to it:

```scss
.segment {
  filter: url(#glitch-outline);   /* survives whatever replaces the animation */
  animation-name: tscaps-glitch-flicker;
}
```

The question to ask of every keyframe: *if this animation never ran, would the design still be
itself?* Motion — `transform`, `opacity`, `clip-path` — answers yes, and is exactly what an
entrance is meant to replace. A filter, a colour, a stroke, a decoration answers no, and
belongs on the element.

If a template's look genuinely cannot survive being animated, say so in
[`features.animation`](template-json.md#feature-opt-outs) rather than hoping nobody tries.

## The library

Fifteen recipes live in `_lib/animation/<id>/`, each a folder holding `_index.scss`, a
`controls.json` listing the fields it offers, and an `icon.svg` where the picker offers it.
`@use '../_lib/animation/rise-in'` resolves through the index file.

**Entrances** — play once as the element arrives:

| Recipe | What it does | Key arguments |
|---|---|---|
| `fade-in` | opacity only | `$from-opacity` |
| `rise-in` | travels vertically while fading; negative distance enters from above | `$distance`, `$from-opacity` |
| `slide-in` | travels horizontally while fading | `$distance`, `$from-opacity` |
| `scale-in` | grows into place, optionally overshooting | `$from`, `$peak`, `$peak-at` |
| `pop-in` | overshoots past its resting scale and settles | `$amount` |
| `snap-in` | rise, rotation and scale springing back together | `$rise`, `$rotation`, `$scale` |
| `wobble-in` | swings into place | `$swing`, `$rest` |
| `settle-in` | microscopic travel, for polish across a whole caption | `$distance`, `$from-opacity` |
| `glitch-in` | stepped displacement | `$x`, `$y` |
| `flash-in` | a plate of light covers the element, holds, and cuts away as it arrives | `$plate`, `$duration` |

**Emphasis and loops** — run for the element's whole life, or mark a state:

| Recipe | What it does | Key arguments |
|---|---|---|
| `bob` | slow rise and fall, forever | `$distance`, `$duration` |
| `jitter` | fast stepped shake | `$x`, `$y` |
| `shimmer` | sweeps a background position across the text | `$travel` |
| `highlight-pulse` | recolours over the narration window and returns | `$rest-color`, `$highlight-color`, `$hold-from`, `$hold-to` |
| `typewriter` | reveals letter by letter with a caret riding along; needs letter mode | `$caret`, `$show-caret` |

Every recipe takes `$element` and — where it is an entrance — `$delay`, which is the clock var
it anchors to. Parameters ride on the element as custom properties, so the `@keyframes` body
is parameter-free and shareable: one template can apply `slide-in` to two elements travelling
in opposite directions off a single block.

**Two entrances on one kind of element share one duration.** Every entrance above except
`flash-in` reads `--entrance-duration`, and a value the Motion tab writes over it lands on every
element of that kind — so a template whose words scale in and whose big word slides in sees one
Duration field move both. To keep one entrance proportionally longer, pass it a scaled duration:

```scss
@use '../_lib/animation/duration';

@include slide-in(
  $element: 'word',
  $duration: duration.scaled(0.12s, 1.67),  // runs 0.2s, and keeps the ratio when the dial moves
  ...
);
```

A plain time is still a duration, and compiles as it always did.

**When to extract into the library, and when not to.** Layout and effect primitives are
harvested on duplication: the same thing exists in two or more templates. Animations are
extracted on **reusability**, because the end state is a user picking one from a catalogue —
so an animation that would suit other templates belongs in the library even at one user today.
What keeps something inline is being welded to its template: it references the template's own
filter ids, its own layout structure, or its own bespoke custom properties. Moving that would
carry the coupling into the library rather than removing it.

## The entrances a user can pick

`_lib/animation/presets.scss` is the second consumer of the library and the only one that is
not a template. Each rule in its `all($delay, $element)` mixin is one entrance the editor
offers for a single word, caption or emoji; the selector is the entrance's id. Adding a rule
adds the entrance, removing one takes it away, and nothing else names them. The list is
compiled once per kind of element, since a picked entrance lands on whichever one it was
picked for.

Two rules the build enforces. An entrance must animate **exactly one** `@keyframes`, because a
rule including two primitives keeps only the second — each writes its own `animation`. And two
entrances may not animate the same keyframes.

**An entrance may exist for some kinds and not others.** The mixin receives the kind it is
compiling for, so a rule inside `@if $element == 'word'` produces an entrance offered for words
alone, and the picker shows it only there. Nothing declares that separately: where an entrance
compiled is where it exists. Reach for it where a look means something on one kind and not on
another — `flash-in` paints a plate the width of what it covers, which reads as a word struck by
light and as a rectangle sitting on anything larger.

**An entrance may paint a generated box of its own**, which is how `flash-in` gets an opaque
layer over the element: nothing else can cover an element's own text, since the only thing that
paints above it is a child. Write it as `&::after` inside the mixin and the build folds it into
the entrance rather than reading it as a second one. Applying an entrance otherwise silences the
element's generated boxes — so a box a template was moving does not keep moving under a new
answer — and the entrance's own box is taken back out of that, by name.

Adding a rule is three obligations: its fields at `<id>/controls.json`, its picture at
`<id>/icon.svg`, and a name that reads as what it does. The build refuses the first two
missing. The picture is drawn rather than rendered from the animation, because these travel in
`em` against caption text, which is a pixel or two at the size of a picker card.

**Entrances only, and not all of them.** `bob` and `shimmer` run for the element's whole life,
`highlight-pulse` needs two colours, `typewriter` needs the engine to have split the word
first: none survives being picked blind for an arbitrary element. Needing a colour is what
keeps an animation off the list rather than what it is: a picked entrance has none to be given,
which is why `flash-in` hides its element with `visibility` instead of repainting it — that
takes the text, its shadow and its stroke together and puts all three back without naming any. `settle-in` is an entrance
and still not on the list — it travels 5px where `rise-in` travels 20px on the same text, so
beside it it reads as nothing rather than as a second option. Templates go on using both. The
list is a set of looks a user can tell apart, not an inventory of the library.

## The fields an animation offers

The fields belong to the animation, not to the picker, so **every animation carries
`controls.json`** — with `[]` where it offers none — including the ones the picker never
lists. A template applying `settle-in` wants its fields as much as a user picking `rise-in`
does.

```jsonc
{
  "id": "distance",
  "label": "Distance",
  "property": "--entrance-rise",  // the custom property the animation declares
  "part": "magnitude",            // "whole" | "sign" | "magnitude"
  "type": "number",
  "unit": "em",
  "min": 0, "max": 1, "step": 0.01
}
```

A field names the custom property it drives, which makes those names part of a recipe's
contract rather than an internal detail — rename one and the fields of every element already
using it stop reaching it. The build refuses a field over a property its animation never
declares.

**`part` splits a signed value between two fields.** `sign` picks a direction, `magnitude`
drags a distance, and both must be present on the same property. Use it wherever the sign
means a direction rather than "less than nothing": a slider crossing zero hides the direction
change in its middle.

**Defaults come from the median of what the templates pass. Bounds do not** — the dataset
gives a centre, not edges — so each bound is a judgement with an argument behind it. Duration
stops at 0.05s because below that an entrance is a cut rather than a motion, and at 1.5s
because past that it outlives the word it belongs to. A vertical distance stops at 1em because
that is one full text height. A swing stops at 30deg because further makes the text unreadable
mid-swing. A loop is bounded on its own terms: `bob` starts at 0.4s because a faster
rise-and-fall reads as a shake, which is what `jitter` is for, and stops at 5s because past
that an element on screen for a couple of seconds never completes a cycle and the float reads
as a fixed offset. **Write the argument down when you add one.**

**A duration only earns a field where a template passes a number.** `jitter` ties its own to
the word's narration window and `shimmer` to a `shimmer-speed` control, so a property over
either would carry no number and open no dial; adding one would be a declaration nobody reads.
Check the call sites before routing a value through a property.
