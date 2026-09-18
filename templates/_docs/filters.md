# SVG filters

For effects beyond what CSS expresses natively — directional motion blur, real chromatic
aberration, displacement noise, morphological outline, volumetric lighting, refraction of the
live video — a template ships a `filters.svg` beside its stylesheet. Each `<filter>` it
declares becomes available to the CSS through `filter: url(#id)`.

This unlocks the whole SVG filter primitive set — `feGaussianBlur`, `feDisplacementMap`,
`feTurbulence`, `feMorphology`, `feSpecularLighting`, `feComposite`, `feColorMatrix`,
`feMerge`, `feImage` — under the same authoring loop as CSS.

Guide: [../AUTHORING.md](../AUTHORING.md) · Library: [library.md](library.md)

---

## Don't reach for one when CSS already does it

- **Isotropic blur**: `filter: blur(Xpx)`, interpolable by CSS animations. `feGaussianBlur`
  only wins when the blur is directional (different X and Y `stdDeviation`).
- **Drop shadow**: `text-shadow` for text, `filter: drop-shadow()` for blocks. SVG only adds
  value when the shadow needs morphological dilation or per-channel offsets.
- **Colour tinting**: `filter: hue-rotate()`, `saturate()`, `brightness()`. `feColorMatrix`
  adds value for arbitrary channel mixing.

Reach for SVG when the effect is genuinely beyond CSS: directional blur, lighting,
displacement, true morphological outline, channel separation, refraction of an external image.

## Which outline to use

There is no primitive that wins, and the choice is part of a template's design.

**`-webkit-text-stroke` + `paint-order: stroke fill`** is a real vector stroke: exact geometry,
continuous at every step of the dial, identical between preview and export. Its failure is the
miter join. On a face with sharp apexes, once the width grows the joins shoot out into spikes,
and there is no portable fix — `stroke-linejoin` does not apply to HTML text. Benched in both
engines: the spikes appear in Chromium and not in Firefox, so this is an artifact of the
majority browser rather than of every engine. The stroke is painted centred, so half the
declared width sits inside the glyph and the visible outward thickness is half of it.

**`feMorphology` dilate** never spikes, and pays for it in resolution. The radius is rounded to
whole *device* pixels — Blink rounds, Gecko ceils, WebKit floors — so at an editor preview
around `1em = 16px`, three consecutive slider positions can render the same single pixel and
the bottom of the range renders nothing at all in Chrome while Firefox renders one. Because the
rounding happens in device pixels, the preview and the export quantize against different sizes:
the same value is proportionally thicker on screen than in the file. Its corners are square,
since the structuring element is a rectangle.

So:

- **Reach for the filter** when the outline is thick enough that the miter spikes show, or the
  face has sharp apexes. That is what loki, naya, freya, iris and kai are answering. Keep the
  control's range above the dead zone — loki floors at `0.025` and naya at `0.04`.
- **Stay on the stroke** when the outline is thin by design or the face has no sharp joins. The
  quantization is a real cost and there is no reason to pay it for an outline whose CSS version
  never breaks. cleo, juno, mira, pepper and zara are on the stroke deliberately.

A third candidate, blurring `SourceAlpha` and sharpening the ramp back with a steep `feFuncA`,
was benched and rejected. It gives continuous thickness, but the contour it produces is the
level set of the *whole word*: it bridges the gaps between glyphs and rounds every corner, so
it reads as a rounded blob behind the text rather than a ring around each letter. Not a subtler
outline, a different effect.

**Swapping a stroke for a filter is not a one-line change.** A CSS `filter` applies to the
element *after* it is painted, so a `text-shadow` on the same element is inside `SourceAlpha`
and any dilation swallows it.

## File shape

A single root `<svg>` with one or more `<filter id="...">` under `<defs>`:

```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"
            color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="var(--tscaps-glow-radius)" result="blurred"/>
      <feColorMatrix in="blurred" type="matrix"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 var(--tscaps-glow-intensity) 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>
```

The `id` is what the stylesheet references. Multiple filters may share the file; ids must be
unique inside it. Attributes on the `<filter>` element itself — the region, `filterUnits`,
`color-interpolation-filters` — reach the browser intact.

**Comments are yours, and they stop at the build.** `filters.build.svg` carries none: like the
block comments in `style.build.css`, they explain the source to whoever maintains it and say
nothing to the runtime, which drops them before parsing anyway. Write as many as the filter
needs.

**`--` is illegal inside an XML comment.** Naming a custom property in prose is the usual way
in. Nothing would render differently, so the cost lands on whoever opens the file next, in an
editor that now calls the document malformed — which is why `templates:build` refuses one
rather than stripping it silently. Refer to a control **by id** (`outline-color`) instead.

## Giving a filter room

`x` / `y` / `width` / `height` on `<filter>` define the rectangle the filter renders into.
Output outside it is silently discarded, and the browser default of 10% padding is rarely
enough:

- `feGaussianBlur stdDeviation="X"` spreads roughly `3 × X` in each direction.
- `feMorphology dilate radius="X"` extends `X` in each direction.
- `feOffset` shifts the image; the region must contain both source and destination.

`x="-25%" y="-25%" width="150%" height="150%"` or larger covers most cases. Tight regions clip
at glyph edges and look broken.

**The source box itself can be too small.** Regions default to `filterUnits="objectBoundingBox"`,
so the percentages are relative to the filtered element's own box. On a text-tight element,
150% of a small box is still a small box. Grow the host's border box with padding and cancel it
with a matching negative margin, so position, alignment and hit testing stay put:

```json
{ "rendering": { "padding": "2em" } }
```

Follows CSS `padding`-shorthand semantics: one token is uniform, two are vertical / horizontal,
three are top / horizontal / bottom, four are top / right / bottom / left. A count outside 1 to
4 throws at load. Length tokens pass through verbatim, so any unit works, and `em` is the one
to use because it scales with the font-size slider. The loader generates the
`.segment { padding: …; margin: -… }` rule at equal specificity, so a template needing
different `.segment` padding for layout reasons can override it with its own rule.

**Where a filter can live** follows from all of this:

- **Bounded effects** (`feMorphology` dilation, small `feOffset`) work on `.word`. iris and kai
  do, with no padding at all.
- **Spreading effects** (`feGaussianBlur`) do not. A Gaussian needs roughly three standard
  deviations to fade out, which a word-sized box clips. They need `.segment` *and*
  `rendering.padding`. loki, naya and freya all carry padding, and loki — the only one with a
  blur — carries the most at 2em.
- **Every filter in a CSS chain clips to its own region**, so a tight region early in the chain
  cuts the later entries short.

## Variable substitution

Any attribute value may reference variables with `var(--name)` or `var(--name, fallback)`:

```svg
<feFlood flood-color="var(--tscaps-outline-color)"/>
<feGaussianBlur stdDeviation="var(--tscaps-blur, 5)"/>
<feImage href="var(--video-frame)"/>
```

The framework resolves these once per output tile against a scope assembled from three sources.

**Style controls** (`--tscaps-<id>`) — every control the template ships contributes one entry
with the **raw stored value and no unit suffix**. A slider with id `blur-amount` at value `5`
becomes `--tscaps-blur-amount: 5`. The filter author controls units inside the attribute
string. This is the difference that bites: the DOM gets `0.14em` and the filter scope gets
`0.14`, so a `var()` inside a filter must resolve to a bare number and its fallback must be
bare too.

**Time-derived helpers**, recomputed per frame:

| Variable | Value |
|---|---|
| `--tscaps-tick` | `floor(currentTime * 30)`, an integer ticking 30 times a second |
| `--tscaps-tick-60` | the same at 60 Hz |
| `--tscaps-time` | `currentTime` as a float |

The ticks exist because `feTurbulence`'s `seed` is truncated to an integer by browsers, so a
float would freeze the noise. A fresh integer per frame is the only path to living noise inside
an SVG filter.

**A tick costs export time, so read one only where the effect moves.** The export draws a
caption once per distinct look and reuses that drawing for every frame resolving to it. A
filter reading a tick resolves to a different look every tick, so those frames are each drawn
from scratch — the price of living noise, and pure waste on a filter whose output was going to
be identical anyway. The same holds for a reference the scope leaves unresolved: what the
document's CSS makes of it cannot be known ahead of the draw, so those frames are drawn one by
one too.

**Engine runtime variables**, when `videoFrame.required` is declared — `--video-frame` and
`--subtitle-region-*` join the scope at the same point the wrapper exposes them to CSS. See
[rendering.md](rendering.md#the-video-frame-layer).

**An unresolved reference passes through intact.** That is deliberate: SVG attributes that
happen to be CSS properties (`flood-color`, `lighting-color`) still resolve through normal
variable inheritance from the wrapper. The framework only needs to substitute the non-CSS
attributes (`stdDeviation`, `seed`, `scale`, `dx`, `href`) that the browser would never resolve.

## Referencing filters from CSS

```scss
.word { filter: url(#outline); }
.word-being-narrated { filter: url(#outline) url(#glow); }

@keyframes tscaps-glitch-burst {
  0%, 4%    { filter: url(#glitch); }
  5%        { filter: none; }
  6%, 9%    { filter: url(#glitch); }
  10%, 100% { filter: none; }
}
```

Multiple references chain in one declaration, applied in order, each taking the previous one's
output as its source. **Order carries meaning**: outline first casts the shadow of the outlined
text; reversed, the outline rings the blur. `@keyframes` can step between filter ids and `none`
to drive on-off rhythms, since CSS does not interpolate between `url(#)` references.

Behind the scenes the framework rewrites these through a variable indirection so per-tile
filter ids can coexist in one render SVG without colliding. The rewrite is transparent. A
reference to an id no document defines fails the contract check.

## Per-element versus per-segment

`filter:` on an HTML element creates a stacking context, and the output is composited at the
element's bounding box. Two consequences:

**Per-element filters overlap their neighbours.** A filter on `.word` renders in that word's
stacking context. Its output can extend past the word box, but neighbour words paint on top in
source order, clipping the previous word's filter on its trailing edge. For an effect that must
bleed past element boundaries — a broad glow, a large displacement — filter `.segment` instead.

**Composition order decides whether an outline survives.** Merging ghosts *under* the source
(`feMerge` with the source as the last node) preserves any `text-stroke` on it, because the
outline is part of the source and lands on top. Merging them on top (`feBlend mode="screen"`)
tints the outline with the ghost colours and visually destroys a dark one.

## Recipes

Three shared fragments live in `_lib/filters/recipes/`. A recipe is a piece of a filter with
`{placeholder}` slots, called from a template's `filters.svg` as a self-closing element:

```svg
<filter id="beast" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
  <tscaps:outline thickness="var(--tscaps-outline-thickness, 0.125)"
                  ink="var(--tscaps-outline-color, #000)"/>
  <tscaps:drop-shadow distance="var(--tscaps-filter-shadow-distance, 0.04)"
                      blur="var(--tscaps-filter-shadow-blur, 0.04)"
                      ink="var(--tscaps-shadow-color, #000)" in="outline-shape"/>
</filter>
```

The root `<svg>` needs `xmlns:tscaps="https://tscaps.io/filters"`. The build expands the calls
into flat SVG and writes `filters.build.svg`, which is what the runtime and the contract check
both read. An unknown recipe, a missing or misspelled parameter, and a non-self-closing call
all throw rather than expanding to nothing.

**A recipe names no variable of its own.** It takes values, and the call site writes the
`var()`. A template that wants a fixed ring passes a literal; one that wants it tunable passes
a `var()` naming its own control. That is what keeps a recipe from obliging its consumer to
declare a control it never asked for.

| Recipe | Parameters | Publishes |
|---|---|---|
| `outline` | `thickness`, `ink`, `in`, `result` | `{result}` (inked ring) and `{result}-shape` (bare dilated silhouette, for a shadow cast by the outlined text) |
| `drop-shadow` | `distance`, `blur`, `ink`, `in`, `result` | `{result}` |
| `chromatic-split` | `x`, `y`, `color-a`, `color-b`, `in`, `result` | `{result}-a` (positive shift) and `{result}-b` (negative shift) |

Numeric parameters are counts of `em` **without the unit** — the recipe appends it and the
runtime resolves it to px per render, since filter primitives take neither relative units nor
`calc()`.

**A filter cannot be invoked from a stylesheet.** A template that wants one authors its own
`filters.svg`. A tier of complete ready-made filters that a stylesheet opted into by id was
built and removed: the filter was not in the template's folder at all, so nothing in the
template said which controls its render read. If it returns it will be a Sass function that
registers the call and returns `url(#id)`, and even then it has a ceiling — a CSS filter list
chains *rendered outputs*, so a filter feeding a named intermediate result to the next stage
(loki feeds its outline's silhouette to its shadow) cannot be expressed from CSS at all.

## SMIL is rejected

`<animate>`, `<set>`, `<animateTransform>` and `<animateMotion>` are refused at parse time.
Image-decoded SVG, which is how the export rasterizes each frame, does not tick SMIL: the
filter freezes at its `from` state. The same template would animate in the preview and stay
frozen in the export, which breaks the invariant the whole design rests on.

For time-varying behaviour, two patterns:

1. **Per-frame seed.** `<feTurbulence seed="var(--tscaps-tick-60)">` produces fresh noise every
   frame. Good for glitch, water, smoke, fire, anything stochastic.
2. **Multi-variant plus CSS keyframes.** Define N variants (`#flicker-soft`, `#flicker-mid`,
   `#flicker-hard`) and step between them from `@keyframes`. The step is discrete, which is
   exactly what gives a flicker its rhythm.

## Filters disable tile dedup

When a template ships a non-empty `filters.svg`, the export's tile deduplication conservatively
treats every timestamp as a unique visual state. The framework has no introspection into how a
filter scope varies with time, so it assumes it does.

A 30-second clip at 30fps that would otherwise dedup heavily renders ~900 unique tiles instead
of however many distinct visual states the caption had. Each is still batched into shared
sprite-sheet SVGs, but more bytes get decoded. For a static effect this is wasted work; the
trade is that filters which *do* need per-frame variation work correctly without asking every
author to declare which kind theirs is. Templates leaning heavily on filters should expect
somewhat slower exports.

## Cross-browser

Well supported in Chrome, Firefox and Safari for the common primitives (`feGaussianBlur`,
`feColorMatrix`, `feMorphology`, `feFlood`, `feComposite`, `feMerge`, `feOffset`). Safari has
had historical issues with `feDisplacementMap` and `feTurbulence` over `<foreignObject>`
content, where output sometimes silently drops or paints a blank rectangle. Test a template
that leans on those in Safari, and if it does not work there, declare `"safari"` in
`unsupportedBrowsers` rather than shipping a broken visual. That covers iOS Chrome and iOS
Firefox with it, which is what you want: on iOS every browser paints with WebKit.
