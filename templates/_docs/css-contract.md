# The CSS contract

What the runtime publishes to your stylesheet, and what your stylesheet owes it back. Every
name here is checked by `templates:contract`, so a typo is a build error rather than a silent
no-op.

Guide: [../AUTHORING.md](../AUTHORING.md) · Controls: [style-controls.md](style-controls.md)
· Animation: [animation.md](animation.md)

---

## The element tree

One caption renders at a time. The renderer swaps it as the playhead crosses a segment
boundary.

```html
<div class="segment">
  <div class="line">
    <span class="word">Hello</span>
    <span class="word">world</span>
  </div>
</div>
```

| Class | Element |
|---|---|
| `.segment` | one caption block, the root of the rendered subtree |
| `.line` | one visible line inside a segment |
| `.word` | one word inside a line |
| `.letter` | one grapheme inside a word, only under [letter mode](#letter-mode) |
| `.word-decoration` | a decoration attached to a word, an emoji for instance |

Two containers the renderer creates rather than reads off the document:
`segment-decorations-above` and `segment-decorations-below`, holding decorations lifted out
of line flow. And `tscaps-video-frame-layer`, emitted inside `.segment` when
`rendering.videoFrame.required` is set — see [rendering.md](rendering.md#the-video-frame-layer).

There is no `.section` element. `Section` is the grouping that decides which splitter and
tagger chain a run of segments goes through; nothing renders it.

## State classes

Recomputed every frame from the playhead. Exactly one per element per frame, on each `.word`
and each `.line`.

| State | Class | When |
|---|---|---|
| Not narrated yet | `word-not-narrated-yet` / `line-not-narrated-yet` | the playhead is before the element |
| Being narrated | `word-being-narrated` / `line-being-narrated` | the playhead is inside it |
| Already narrated | `word-already-narrated` / `line-already-narrated` | the playhead has passed it |

Because they are added and removed as the playhead moves, an animation scoped to one only
runs while the class is present, and gets cut if the state is shorter than the animation.
[animation.md](animation.md) has the right way to bind an animation to a state change.

> **A state class must never change the element's size.** `font-weight`, `font-size`,
> `letter-spacing`, `padding`, `margin` and `font-family` all feed layout, so the word takes a
> new width the instant the playhead reaches it and every word after it on the line jumps
> sideways. Once per word, for the whole line. Mark the state with `color`, `background`,
> `text-shadow`, an absolutely-positioned `::before`, or `transform`, which paints without
> reflowing.
>
> A weight change looks safe while the template's own font is monospace, because there every
> weight is the same width. It is not: `font-family` is one of the user's controls, and the
> moment they pick a proportional family — or the browser falls back to one because the
> declared family does not cover their script — the line starts jumping.

## Structure tag classes

Assigned once after splitting, naming a position in the text:

- `first-word-in-line`, `last-word-in-line`
- `first-word-in-segment`, `last-word-in-segment`
- `first-word-in-section`, `last-word-in-section`
- `first-line-in-segment`, `last-line-in-segment`
- `first-line-in-section`, `last-line-in-section`
- `first-segment-in-section`, `last-segment-in-section`
- `first-segment-in-document`, `last-segment-in-document`

Use them when the styling is genuinely about that position, such as giving the opening word of
a line its own typography. For the two ends of a *painted* line box, use `:first-child` /
`:last-child` instead — see [right-to-left](#right-to-left-and-mixed-script-text).

Semantic tag classes also exist, produced by taggers, and are entirely consumer-defined. An
unknown class simply has no styles attached, so a new tag category never breaks a stylesheet.

## Timing variables

Every rendered element carries the clock, relative to the current frame. These are what every
animation anchors to.

| Variable | Value |
|---|---|
| `--on-<state>-starts` | seconds until that state begins, negative once it has |
| `--on-<state>-ends` | seconds until that state ends, negative once it has |
| `--<state>-duration` | how long that state lasts, in seconds, constant per element |

`--on-…` names an event, so it carries the `on-` prefix. A duration is a span, not a moment,
so it does not.

Available states: `segment`, `line-not-narrated-yet`, `line-being-narrated`,
`line-already-narrated`, `word-not-narrated-yet`, `word-being-narrated`,
`word-already-narrated`.

**Sign convention.** `--on-word-being-narrated-starts` evaluates to
`(word.start - currentTime)`, so it is negative while the word is being narrated. CSS reads a
negative `animation-delay` as "this animation has already been running that long", which is
exactly how an animation anchors to the playhead.

## Structural metadata

Unitless integers, published on every render so a rule can stagger, scale or branch by an
element's position and size without randomness. No `on-` prefix: they are not events.

| Variable | Where | Value |
|---|---|---|
| `--segment-index` | `.segment` | the segment's 0-based position within its section, for varying an effect per caption |
| `--segment-char-count` | `.segment` | character length of the segment's full text, the input for auto-shrink rules |
| `--line-char-count` | `.line` | code points the line paints, one separator counted between adjacent words |
| `--line-width-em` | `.line` | the line's **measured** rendered width as a multiple of its font size — divide a target width by it to get the size that fills exactly. Only emitted when the stylesheet reads it, and measured with the segment in its behind-actor state. Prefer it over `--line-char-count` for anything about width: the same character count is half again as wide in round letters as in narrow ones |
| `--previous-line-width-em` | `.line` | the `--line-width-em` of the line above it in the segment, in that line's own `em`; absent on the first line. For lining one line up against the one before it — multiply by the size that line renders at to get its width. Only emitted when the stylesheet reads it |
| `--segment-anchor-y` | `.segment` | where the caption's anchor landed, as a fraction of the frame's height |
| `--segment-anchor-origin-y` | `.segment` | share of the caption's own height placed on that anchor — `0%`, `50%` or `100%`. Inside a `translate` it resolves against the box, so undoing both variables converts any anchor to a top-edge one without knowing how tall the caption grew |
| `--word-index` | `.word` | the word's 0-based position within its line |
| `--word-count` | `.segment` and `.line` | number of words in each; the nearest ancestor wins for a `.word` reading it |
| `--word-char-count` | `.word` | code-point length of the word's display text; a surrogate-paired emoji counts as 1 |
| `--last-word-char-count` | `.segment` and `.line` | length of the closing word, without traversing to it |

CSS cannot branch on a variable's value, but `calc(min(1, max(0, …)))` over one gives a
discrete 0/1 switch you can interpolate into any numeric property. Non-numeric properties
(`white-space`, `font-family`) have to be applied unconditionally and neutralised visually
when the switch is 0.

Two more the engine writes for its own baseline rules, which a template can read but rarely
needs: `--segment-padding-top` and `--segment-padding-bottom`, the padding put on the segment
to give a filter room to spread.

## Letter mode

Opt in with `"rendering": { "splitWordsIntoLetters": true }`. Each word's text is then wrapped
one `<span class="letter">` per grapheme:

```html
<span class="word">
  <span class="letter">H</span><span class="letter">e</span><span class="letter">y</span>
</span>
```

Two extra variables come with it:

| Variable | Where | Value |
|---|---|---|
| `--letter-index` | `.letter` | the letter's 0-based position within its word |
| `--letter-count` | the parent `.word`, inherited | number of letters in the word |

Splitting is grapheme-correct: accented characters, surrogate-pair emoji and ZWJ sequences
each form a single `.letter`. Three costs come with it, and they are inherent rather than
bugs:

- Kerning between adjacent letters is lost, since each letter is its own text run.
- OpenType ligatures are disabled.
- Cursive scripts that rely on letter joining (Arabic, Syriac, N'Ko) skip letter mode
  automatically: the word is painted whole and its `.letter` children never exist. Give the
  template a fallback so the word still animates, keyed off the word's own clock:
  `.word:not(:has(.letter)) { … }`. Without one, the word is simply there from the first
  frame.

Letter mode also forces the frame renderer to redraw every frame — see
[animation.md](animation.md#pattern-d--per-letter-timing) for why.

## Right-to-left and mixed-script text

The engine resolves the Unicode bidirectional algorithm per line and emits `.word` elements
**already in the order they paint**. On a right-to-left line that is the reverse of the order
the words are said; on a mixed line the two interleave.

Four consequences:

- **Positional selectors select by painted position.** `:first-child`, `:last-child` and
  `nth-of-type` no longer mean "first spoken". To style or stagger by speaking order, use the
  structure tag classes or `--word-index`, which stay logical.
- **Structure tag classes select by speaking position.** `first-word-in-line` is the word said
  first, which on a right-to-left line is the box at the *right* end. A rule reaching for a
  physical side — `border-top-left-radius`, `margin-right`, `padding-left`, `left` — hung off
  a structure tag class will land on the wrong end and carve the decoration out of the middle
  of the line. Ask which one the rule is about: the ends of the painted strip are
  `:first-child` / `:last-child`; the word the sentence opens with is `first-word-in-line`.
- **Nothing in the DOM says which way the line reads.** Words arrive in painting order inside
  a line pinned to `direction: ltr`, so a design that points at a side has to be told. Read
  `--tscaps-text-direction`, below.
- **A word can be more than one element.** When a word's punctuation resolves to a different
  embedding level than its letters, the algorithm paints it in two places and the engine emits
  one `.word` per piece. Every piece carries the same classes and the same variables, so
  per-word styling and the narration highlight reach all of them. Rules that count children
  (`nth-child(3):last-child`) count *elements*, not words.
- **A piece that lands away from the rest of its word also carries `detached-word-fragment`.**
  See below — it is the one hook a stylesheet has to think about.

### `detached-word-fragment`

Most of the time a word's pieces paint flush against each other and read as one box, and
nothing special is needed. Sometimes they land apart — a right-to-left line closing on
`this is a test.` puts the full stop three words away from `test` — and then the piece holding the word's letters carries the word and
every other piece gets this class.

Which effects have to exclude it comes down to what the effect is for:

- **Effects that reveal** — a colour change, an opacity, a fade or rise keyed to the word's
  clock — answer *"has this been said?"*. The stray piece is read at the same moment as the rest
  of its word, so it must reveal with it. Leave these alone.
- **Effects that point** — a pill, a background, an underline, a scale pop — answer *"where is
  the word right now?"*. A pointer several words away from the letters it names is noise, so these
  exclude the class:

```css
.word-being-narrated:not(.detached-word-fragment)::before { … }
```

Getting this wrong paints two disconnected boxes at opposite ends of a mixed line. Excluding the
class from a reveal instead leaves one stray mark stuck at the wrong colour. Templates in the
gallery that point: `vera`, `pepper`, `kel`.

### `--tscaps-text-direction`

Always emitted, holds `ltr` or `rtl`, and is read differently from every other variable: it is
meant for a **style query**, not for `var()` substitution.

```css
@container style(--tscaps-text-direction: rtl) {
  .line:last-child::after { left: auto; right: -0.23em; transform: scaleX(-1); }
}
```

Most templates need nothing here. Reach for it only when the design **points at a side** and
that side should follow the reading direction: a speech-bubble tail, a gutter bar, a column
the eye is meant to land on first, the side an entrance slides in from. Rounded ends, edge
margins and anything else about the two ends of the painted line box need no query at all —
`:first-child` / `:last-child` already hold them.

Wrapping physical properties in the query is the point rather than a workaround. `.line` is
pinned to `direction: ltr` so the words the engine already ordered are not reordered again,
which means CSS logical properties (`inset-inline-start`, `border-start-start-radius`)
resolve against that pin and cannot express the reading side.

## Cascade layers, and why `!important` is banned

Four layers render, in this order: the framework's own baseline, the template's
(`tscaps-template`), the style sheet's generated CSS (`tscaps-sheet`), and the per-element CSS
a user writes for one word or one caption (`tscaps-element`). Later wins, so an element's own
rule beats the template's without anyone out-specifying anyone.

**`!important` reverses that.** Cascade layers invert for important declarations: the
*earlier* layer wins. The template's layer is declared first, so an `!important` in a template
stylesheet is not a strong rule, it is an unreachable one. Measured, with a template rule
marked important:

| What tries to override it | Result |
|---|---|
| a per-element fragment | loses |
| a per-element fragment marked `!important` | loses |
| an inline declaration | loses |
| an inline declaration marked `!important` | wins |

Only the last gets through, and nothing in the editor emits it. So one `!important` disables
every per-element customisation of that template — the colour picker and the size slider
included, since the structured overrides land as inline *normal* declarations. No error, no
explanation; the panel simply stops doing anything.

The contract check rejects it, and it matters less for the templates in this repository (none
uses it) than for the Code tab, where a user edits their own template CSS into that same
layer.

## Addressing one element

A class reaches every element of its kind. The editor lets a user style one, and it does that
by asking the engine to stamp `data-tscaps-el="<id>"` on the elements a stylesheet addresses.

A template rarely writes such a selector itself — the ids are per-project — but it is worth
knowing the attribute exists, because a rule of yours marked `!important` (see above) is what
would stop it from working.

## Things that surprise

**A variable is only stamped if something reads it.** The renderer scans the stylesheet for a
literal `var(--name)` before writing that custom property onto the element. A rule that reaches
a value some other way — through a `@container style()` query, or by building the name with
`@property` — never gets the value written. Keep a literal read for every variable your CSS
depends on. (A custom property read *only* through a style query used to be dropped for this
reason; it is not any more, but the underlying rule still holds for anything else.)

**Some variables are only emitted under a condition.** `--tscaps-text-decoration` appears only
when underline or strikethrough is set; the decoration multipliers only with an emoji effect
configured; `--subtitle-region-*` only when `videoFrame.required`; a per-caption
`--tscaps-highlight-color` only for a non-single colour recipe. Always write a fallback.

**Everything renders scoped.** Your CSS is rewritten under a random `tscaps-render-*` ancestor
and your `@keyframes` are renamed per render scope, so two sheets on one page cannot collide.
This is transparent — you write ordinary selectors and ordinary keyframe names — but it is why
a selector reaching outside the caption subtree does not work.

## Shared assets

Binary assets live in a shared pool at [`../_assets/`](../_assets), not in your template's
folder. Any file there with an accepted extension (`.png`, `.svg`, `.jpg`, `.jpeg`, `.webp`,
`.gif`, `.avif`) is bundled with a content-hashed URL and reachable from every template's CSS:

```css
.segment { mask-image: url('asset:marker-stroke'); }
```

At load the runtime rewrites each `asset:<id>` token to the resolved URL. An unknown id throws
at load time, so a missing asset surfaces immediately rather than rendering a broken template
in silence, and `templates:contract` catches it before that.

The pool is shared because a mask or texture useful to one template is usually useful to
others, and deduplication beats per-template copies.
