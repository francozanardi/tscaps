# Preview, export, and layout

The live preview renders into the live DOM; the export renders each frame as an SVG with a
`<foreignObject>` and rasterizes it to a bitmap. The two agree on most things. This page is
the handful of places they do not, plus the two engine features whose contract a template opts
into, plus what the line splitter can and cannot see.

Guide: [../AUTHORING.md](../AUTHORING.md) · Schema: [template-json.md](template-json.md)

---

## `transition` works in the preview and not in the export

Transitions interpolate against the previous DOM state. The export builds each frame from
scratch, so there is no previous state and the transition collapses to an instant change.
Avoid `transition` in template CSS entirely; see
[animation.md](animation.md#the-frozen-frame-model).

## Subpixel rendering

The live DOM is composited by the browser with full GPU subpixel positioning. A one-pixel
translation animated over 400ms produces around 24 intermediate frames, each at a sub-integer
offset, and the movement is essentially imperceptible.

The export rasterizes the SVG to a canvas per frame. Subpixel transforms inside the SVG are
honoured during layout, but the rasterization snaps to integer pixel boundaries. A one-pixel
translation over a few frames can therefore look stepped in the export while it is smooth in
the preview.

- Do not rely on movements smaller than 2 pixels reading smoothly in the export. If the effect
  must be subtle, use colour, opacity or scale rather than a small translation.
- If the difference matters, increase the amplitude until it reads cleanly in the export and
  accept that the preview will be slightly more visible.

**The same snap hits `px`-sized shadows, borders, hairlines and outlines.** A `1px` inset
shadow that reads sharp at 480p falls between integer pixels at 1080p, where one CSS pixel is
a smaller fraction of the rendered frame, and gets antialiased to barely visible — sometimes
asymmetrically, with the top edge gone, the bottom faint and artifacts in the corners. The bug
only appears at high resolutions and only in export.

- Express shadow offsets, blurs, spreads, hairline borders and outlines in `em` (or `cqh`),
  never `px`. Font size is already in `cqh`, so `em` scales with the rendered frame
  automatically: a `0.04em` shadow renders about 2px at 720p and 3px at 1080p, both above the
  threshold.
- This includes the drop shadow on a glass plate (`box-shadow: 0 6px 22px …` becomes
  `0 0.15em 0.5em …`), the 1px inner edges that form a border, and any decorative hairline.
- **SVG filter primitives are a separate case.** `feGaussianBlur stdDeviation`, `feOffset
  dx/dy` and similar attributes do not accept `em` — they are in user-space pixels per the SVG
  spec. A `stdDeviation="2"` blur renders with the same absolute spread at 480p and 1080p,
  which makes it *relatively thinner* at 1080p. If the effect depends on hairline-class
  spreads it fades out at high resolution the same way a `1px` shadow does, and there is no
  in-CSS workaround today. Tune to a value that survives at the highest target resolution.

## Font loading

The export's SVG runs in an isolated CSS context: host page stylesheets, including the global
font catalogue, do not apply. The export pipeline prepends only the `@font-face` blocks for the
fonts each sheet actually uses, then inlines those `woff2` files as base64 data URIs. As long
as the template references a family the catalogue ships, this is transparent.

A family outside the shipped set falls back to a system font in the export. Stick to a family
the consuming app already bundles, or coordinate with the consumer to add it before relying
on it.

## The video-frame layer

Some templates use the pixels of the underlying video: blurring them for a frosted-glass
plate, blending words against them with `mix-blend-mode`, refracting them through a glyph
silhouette with an SVG `feImage`. Both render paths converge on one DOM hook, a
`<div class="tscaps-video-frame-layer">` inside the segment.

Opt in with `"videoFrame": { "required": true, … }`. The framework supplies the layer's
geometry and its pixel source through baseline CSS — positioning, sizing, and either the JPEG
via `--video-frame` in export or a live `<video srcObject>` in preview. The template adds only
its own override on `.tscaps-video-frame-layer`, typically `filter`, `z-index` or a
compositing property.

**A `filter` on the layer needs `transform: translateZ(0)` beside it.** Without a layer of its
own, Safari draws the filter's output square across a rounded, `overflow: hidden` parent when it
rasterizes the export, and covers that parent's shadow. `selene` carries the pair.

**`previewMode`** decides how the preview surfaces the frame:

- **`"omit"`** (default): no layer is mounted live. The template handles the preview itself if
  it wants an effect bound to the video, through `backdrop-filter` on the segment for example.
  Pay nothing in preview if you can tolerate a discrepancy, or if the effect does not depend
  on the video pixels at all.
- **`"live"`**: a `<video srcObject>` mirroring the main player is mounted in the layer's
  place. The same rule on `.tscaps-video-frame-layer` applies to both the live `<video>` in
  preview and the `<div>` with the JPEG background in export, so one rule lands the same effect
  in both paths. Costs one extra GPU composite layer per active caption.

Pick `"live"` when the template needs the video pixels literally. Pick `"omit"` when it can
fake the effect in preview, or when the pixels are not visually load-bearing.

**The custom-property contract**, guaranteed on the wrapper of every active segment and also
injected into the SVG filter scope:

| Variable | Value |
|---|---|
| `--video-frame` | `url(...)` of the frame slice in export; unset (resolves to `none`) in preview |
| `--subtitle-region-width` / `-height` | dimensions of the slice's viewport rectangle |
| `--subtitle-region-x` / `-y` | offsets that put the layer's origin at the slice's top-left in viewport coordinates |

In preview the region dimensions resolve to `100cqw` / `100cqh`, the full viewport. In export
they are the cropped slice in pixels: the framework crops `--video-frame` to the caption's
painted area plus a small safety bleed, or the declared `rendering.padding`. Either way the
rectangle they describe is the rectangle the `--video-frame` URL fills, so `feImage` and
`background-image` consumers align without extra maths. The framework's default rule for the
layer already consumes them; a template only reads them if it builds its own positioning.

**Keep the entrance on the blending element.** A template that blends against the frame must
not animate any *ancestor* of the blending element with a property that forms a stacking
context — `transform`, `clip-path`, `opacity`, `filter`, `will-change`. An animation on `.line`
or `.segment` isolates the words: the blend stops reaching the frame, the text paints flat,
and it snaps back when the animation ends. The same property on the blending element itself is
harmless, because `mix-blend-mode` already gives it a stacking context of its own. Put the
entrance on `.word` and let the delay reach it from the line's or segment's window by
inheritance (milo, luna), or keep the animated line and the blending word in different lines
(luca). Then declare the opt-out in
[`features.animation`](template-json.md#feature-opt-outs) so the editor does not offer what
would break.

**Give a blended word room in the slice.** The slice is measured once per caption, on the
caption's layout as it starts: before the measured widths reach it (`--line-width-em` and the
others fall back to their defaults) and without any transform, which never moves layout. A
blended word that ends up larger or elsewhere than that layout reaches past the slice, and
where it does it blends with nothing and shows its own colour: a word sized from its measured
width, one that drops in with a `translate`, one that arrives stretched by a `scale`. Declare
[`rendering.padding`](template-json.md#rendering-switches) to cover the most it grows or moves.
suki does, for a big word sized from its own width that drops in from above.

**Caveat with `"live"`.** A `<video>` element is not a URL. CSS that requires an image URL —
SVG `<feImage href>`, `background-clip: text` over a URL background, `mask-image: url(...)` —
only works in export, where the engine inlines the JPEG as a data URL. There is no
cross-browser way today to feed a live `<video>` into those APIs, so a filter whose effect
depends on `var(--video-frame)` as an `feImage` source appears correctly in export and
silently does nothing in the preview.

## Text behind the actor

```jsonc
"behindActor": { "required": true, "tagCondition": "peak or hook" }
```

When the scene is a good fit — a person is present, the shot is steady and sharp — the actor's
silhouette is composited **above** the caption, so the text appears to sit behind them. The
framework owns the heavy lifting: scanning the video, caching the actor masks, deciding
activation, and painting the cutout in both preview and export. The template declares *which
captions qualify* and styles *how the caption reacts*.

**`tagCondition`** is a boolean tag expression evaluated per segment against the union of the
segment's tags: its own structure tags plus every word's tags. `and` / `or` / `not` and
parentheses compose; every other token is a tag name. Absent means every segment qualifies. A
malformed expression fails at template load.

**The activation class** is the framework's single decision — the template opted in, the
segment matched, and it sits fully inside a scene-valid window, or the user forced it on —
published as one class on `.segment`:

```
behind-actor-active     present while the effect is active; absent otherwise
```

It is a class rather than a custom property because a template reacts with non-numeric
properties too. The vertical lift is a plain rule; expose its magnitude as a control, which
the framework emits back as `--tscaps-behind-lift`:

```scss
.segment.behind-actor-active {
  translate: 0 calc(-1 * var(--tscaps-behind-lift, 0px));
  font-family: 'Fraunces Variable';   /* restyle freely: fonts, colours, animations */
  font-style: italic;
}
```

```jsonc
{ "id": "behind-lift", "type": "float", "default": 30, "min": 0, "max": 55, "step": 1, "unit": "cqh" }
```

The lift matters because the actor typically occupies the middle and lower half of the frame;
without a vertical shift the caption sits fully behind them and only the cutout shows. Keep it
inside `.segment.behind-actor-active` so it is inert when the effect is off.

**What the user sees.** Picking an opt-in template prompts a one-time in-browser scan of the
video, with progress and cancel. The scan finds the scene-valid windows and caches the masks; a
per-caption menu lets the user force the effect on or off. A caption activates automatically
only when its **entire** time range fits inside one valid window, so segments straddling a
boundary stay off and the effect never flickers mid-caption. Force-on works on every template,
since the class is published regardless; a template that writes no rules for it simply shows
the cutout over the un-moved caption.

## How the line splitter measures

The engine's line splitter decides where to break a long caption by measuring how wide each
candidate run of words would render. The measurement is analytical: typography (font, weight,
size, letter and word spacing, padding, margin, text transform) is resolved against a hidden
shadow-DOM probe, then each word's width is computed with Canvas 2D `measureText` plus
per-letter spacing and per-word padding and margin contributions added arithmetically.

The probe is styled with the classes each word will carry, so a rule that changes the face,
the weight or the size of `.emphasis`, `.accent`, `.entity` or a structure tag is measured at
the size it renders at rather than at a plain word's. Grow a tagged word freely; the lines
are broken around what it actually costs.

**It looks only at the words' text strings.** Anything painted through `::before` / `::after`
is invisible to it. That is almost always correct: a purely visual extension should not bias
the wrap decision toward earlier breaks. A line-number gutter at a negative `left`, a title bar
above the text area, a caret positioned past the last letter — none of them needs measuring.

**Where it bites** is a pseudo carrying inline textual content whose width *should* count:

- a glyph prefix on `.line::before` that displaces text to its right, rather than being
  absolutely positioned in a gutter
- content on `.word::before` that visually extends the word inline

For those, render the glyph inside a real element — an extra wrapper, or a structure tag — so
its text reaches the measurer through a word.

