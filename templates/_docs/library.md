# The Sass library and the build

`templates/_lib/` holds the primitives every template can call, and the build turns a
template's Sass into the flat CSS the runtime reads.

Guide: [../AUTHORING.md](../AUTHORING.md) · Animation recipes: [animation.md](animation.md#the-library)
· Filter recipes: [filters.md](filters.md#recipes)

---

## The build

Every template ships two files where one is committed:

- **`style.scss`** — the source you edit. May `@use` anything in `_lib/`.
- **`style.build.css`** — flat, standards-only CSS. Gitignored, regenerated, and the only
  thing the runtime ever reads.

```bash
pnpm templates:build
```

Runs `sass.compile()` per template in expanded mode with `_lib/` on the load path, strips
block comments, collapses blank runs, and writes the result. Root `postinstall` regenerates it
on every install and both deploy workflows run it explicitly before the contract check.

Four more artifacts are written the same way and are gitignored the same way:
`filters.build.svg` (the authored `filters.svg` with its recipe calls expanded and its XML
comments stripped, on the same reasoning as the CSS ones), `controls.build.json` (the controls
a stylesheet declared while compiling) and `animations.build.json` (the animations it
applied), plus `fonts.build.json` (the fixed font stack IDs it references). **Never edit a `.build.*` file, and never commit one.**

**The split is the point.** The author edits the source, the runtime reads the built output,
and they never share responsibility. What the editor's Code tab shows, what an agent writing
CSS sees, and what a saved project flattens into its own copy is always the runtime side:
flat, self-contained, standard CSS. Anyone who knows only CSS can edit the artifact in front
of them without reading a line of this folder.

A template that uses no primitive at all may stay as plain `style.css` and the build passes it
through. Every template in the gallery uses at least one, so `style.scss` is the normal case.

**Full Sass is available**, including control flow (`@if`, `@for`, `@each`) and the standard
modules. The output is flat regardless. Two cautions:

- **Custom property values are opaque to Sass**, so calling a function inside one needs
  `#{...}` interpolation: `--tscaps-font-size-scale: #{dynamic-font-size(0.06)};`. Inside a
  normal declaration or an `@include` no interpolation is needed.
- **Sass unwraps `calc()` when it can fold the arithmetic itself.** `calc(15 / var(--x) * 1em)`
  compiles to a bare `15 / var(--x) * 1em`, which is not a valid value. Writing it as
  `calc(15em / var(--x))` keeps the wrapper.

## Author workflow

Edit `style.scss`, run `templates:build`, and the dev server reloads. If that round trip gets
in the way, wiring Sass through a Vite plugin that transforms on import is the fix; Vite
detects Sass automatically when it is installed.

---

## The primitives

### `segment-typography`

The universal `.segment` block: the whole font, colour and alignment surface a template
exposes through the `--tscaps-*` controls, from your own defaults.

```scss
@use '../_lib/segment-typography' as *;

.segment {
  @include segment-typography(
    $font-family: 'Bungee',
    $font-size: 3.91cqh,
    $font-style: italic,
    $line-height: 1.05,
    $text-transform: uppercase,
  );
}
```

`$font-family` and `$font-size` are required. The rest default sensibly:
`$font-weight: 400`, `$font-style: normal`, `$text-align: center`, `$letter-spacing: 0em`,
`$line-height: 1.2`, `$text-transform: none`, `$color: #ffffff`, `$rotation: true`.

Three opt-outs exist for templates that would fight the block:

- `$rotation: false` skips the `rotate` line, for flex-line layouts.
- `$color: null` skips `color`, for templates that paint colour elsewhere: a background pill
  on `.line`, a `background-clip` gradient, a filter-based fill, per-state colours only.
- `$line-height: null` skips it, for a face whose native metrics already give the leading.

It wraps font size in `calc(… * var(--tscaps-font-size-scale, 1))`, which is the hook the
editor's per-word size override reads. A template that opts into no auto-shrink leaves the
hook at its `1` fallback and renders identically to a plain `font-size: var(--tscaps-font-size, X)`.

Anything else your `.segment` needs — a container name, geometry vars, padding, background
chrome, an entrance — goes before or after the include. The mixin owns typography only.

### `word-layout`

The universal `.word` layout: inline-block box, the spacing control, and the
`text-decoration` hook the underline and strikethrough toggles write into.

```scss
@use '../_lib/word-layout' as *;

.word { @include word-layout(0.12em); }
```

The argument is your default spacing. Typical range 0.08em to 0.16em, snug to airy.

Templates that break the shape — a flex row spacing via `column-gap` on the parent, or a
background pill via `padding` plus `background-color` — skip the mixin and write `.word` by
hand.

### `soft-drop-shadow`

Returns a `x y blur colour` shadow spec, usable directly inside `text-shadow`, `box-shadow`,
or as an argument to `filter: drop-shadow(...)`.

```scss
@use '../_lib/soft-drop-shadow' as *;

.word { text-shadow: soft-drop-shadow(0.08, 0.4); }
```

`soft-drop-shadow($distance, $blur, $color: #000000)`. The arguments are your defaults for the
three `--tscaps-shadow-*` controls, and **the controls come with the call** — a template using
this shadow gets three sliders without declaring anything.

Composable inside a shadow stack, as long as every call in one template passes the same
defaults: they describe one shadow the stack repeats rather than several independent ones, and
the build rejects a template that asks for two.

**Careful with blur.** `text-shadow` and `box-shadow` read their third length as a radius,
while `filter: drop-shadow()` reads it as a Gaussian standard deviation, which is half of
that. The same number is twice as soft inside `drop-shadow()`.

### `glow`

Light coming off the glyphs, in the text's own colour. Returns a comma-separated shadow list,
so it stacks in front of a cast shade:

```scss
@use '../_lib/glow' as *;

.word-being-narrated { text-shadow: glow(0.16), soft-drop-shadow(0.06, 0.25); }
```

`glow($radius, $passes: 1, $color: currentColor)`. `$radius` is your default for the
`--tscaps-glow-radius` control, and **the control comes with the call**.

`currentColor` is what makes one rule reach every case — an accent, a proper noun, the word
being narrated all glow in whatever they are painted, with no rule per case.

**A glow does not hold a caption against its shot.** It carries the text's colour, so over a
bright frame it adds light to light and takes the edge with it. Put one only on a template that
already separates some other way — an outline, a hard cast shade, a plate — and leave that
separator alone. Templates whose whole separation is a same-colour halo (`hugo`, `sara`) are
visibly soft on a pale shot, which is the trade their look accepts, not a pattern to copy.

**`$passes` repeats the layer instead of widening it**, which is how a halo gains weight
without gaining reach: one pass reads as a blur on the letters, two as light off them.

#### `glow-filter`

The same glow for a template that paints through `filter`. Returns space-separated
`drop-shadow()` functions:

```scss
.segment { filter: drop-shadow(soft-drop-shadow(0.03, 0.12)) glow-filter(0.12, $color: #ffd84d); }
```

**Required, not preferred, when the text is filled by a `background-clip: text` gradient.** A
background paints *beneath* the text shadow, so a `text-shadow` there covers the fill it was
meant to sit behind and floods the letters with the halo's colour. Such a template also has no
current colour to take — its `color` is `transparent` — so it must name one.

**Put it last in the chain.** Each function feeds the next, so a glow placed before an outline
built from `drop-shadow()` passes becomes their input and they draw a hard edge around the halo
itself.

The radius halves on the way in, so the control means one softness whichever mechanism a
template paints with. See the blur note under `soft-drop-shadow`.

### `dynamic-font-size`

Renders short captions bigger than long ones: a one-word caption appears visually larger than
a twelve-word one. Returns a scale multiplier, and declares the "Dynamic font size" toggle
whose ON state is the character-count threshold below which a caption grows.

```scss
@use '../_lib/dynamic-font-size' as *;

.segment { --tscaps-font-size-scale: #{dynamic-font-size(0.06)}; }
```

`dynamic-font-size($strength: 0.15, $enabled: true)`. `$strength` is how aggressively a
caption grows below the threshold; typical range 0.06 (subtle) to 0.15 (aggressive). Reads
`--segment-char-count`, which the engine emits per caption.

Note the `#{...}`: it is inside a custom property value.

### `control.field`

Declares a style control and reads it in one step. This is what the primitives above use, and
templates call it directly for a control of their own that the catalogue already describes.

```scss
@use '../_lib/control';

.word { border-radius: control.field('bg-radius', 0.2); }
```

`control.field($id, $default)` returns `var(--tscaps-<id>, <default><unit>)` **and** adds the
control to the template being compiled, with the label, type, unit and bounds the concept has
everywhere else. You supply only the default, which is the part that is your look.

**Defaults are passed unitless.** The unit belongs to the concept, so a stylesheet writing one
would either repeat the catalogue or contradict it, and the build rejects it rather than
picking.

The id must be one the catalogue describes; an unknown one fails the build with a did-you-mean
rather than producing a variable no editor can drive. See
[style-controls.md](style-controls.md#what-the-build-refuses) for the full refusal table.

### Animation recipes

Fifteen of them, one folder each under `_lib/animation/`. Documented in
[animation.md](animation.md#the-library).

### Filter recipes

Three of them under `_lib/filters/recipes/`, called from a template's `filters.svg` rather
than from Sass. Documented in [filters.md](filters.md#recipes).

## Fixed font stacks without controls

```scss
@use '../_lib/font-stack' as *;

.accent {
  font-family: font-stack('kalam');
}
```

This compiles to `font-family: var(--tscaps-font-stack-kalam)`. The argument is a
[font stack catalog](../../apps/studio/src/core/fonts/domain/FontStackCatalog.ts) ID;
unknown IDs fail the build. No control is created. Repeated references record one
dependency in `fonts.build.json`, which is kept with saved user templates.

The runtime supplies the variable using the catalog stack and the sheet's current
scripts, independently of the user's typography choices. Preview and export use the
existing composite-family compiler; export embeds only the required font subsets.
Use a font control when the user should be able to change the stack instead.

Writing the variable alone does not declare a new dependency: use the Sass helper
when authoring a template. The Code tab can reuse variables already declared by its
template. A literal `font-family: 'Kalam'` still selects the individual font face.
