# Before you ship

Run through this before opening a PR. Each item links to the reference that explains it.

```bash
pnpm templates:build
pnpm templates:contract
```

Both must be clean. The contract check catches most of what follows; the rest is what only a
human or a rendered frame can see.

---

## Structure

- [ ] The folder lives directly under `templates/`, its name is the template id, and that name
      is in `BUILTIN_TEMPLATE_NAMES`
      ([`apps/studio/src/core/templates/domain/BuiltinTemplateNames.ts`](../../apps/studio/src/core/templates/domain/BuiltinTemplateNames.ts)).
      The contract check fails on an unregistered folder and on a dangling list entry.
- [ ] The folder carries only `template.json`, `style.scss` (or `style.css`), and optionally
      `filters.svg`. No `.build.*` file is committed.
- [ ] `template.json` carries a `description`: a sentence or two on what the captions look like
      and what they suit, written for someone choosing without seeing them. The contract fails
      without one. Then run `pnpm --filter @tscaps/studio-close templates:reference` and commit
      `skills/tscaps-api/references/templates.md`, which is generated from the descriptions; the
      contract fails while it is stale.
      → [template-json.md](template-json.md#identity)
- [ ] Any binary asset the CSS references lives in the shared [`_assets/`](../_assets) pool and
      is referenced as `url('asset:<filename-without-ext>')`.
      → [css-contract.md](css-contract.md#shared-assets)
- [ ] **A `key-moments` or `modern` template ships a sample clip and a poster**, as
      `apps/studio/public/templates/<id>.mp4` and `<id>.jpg`. Those two families are previewed in
      the gallery as a recorded 9:16 sample with the captions burned in, not as a rendered tile,
      and the URLs are built from the template id with no fallback, so a missing file is an empty
      card. The contract checks the poster exists, not the clip. The card shows the middle 900 rows of the sample's 1280, so
      confirm the captions survive that crop across the whole clip and not just one frame.

## The variable contract

- [ ] The stylesheet reads every universal typography variable through
      `var(--tscaps-<id>, <fallback>)`, so every editor control takes effect. The loader warns
      at load for a missing one, but the audit is faster than waiting for the warning.
      → [style-controls.md](style-controls.md#the-universal-set)
- [ ] `--tscaps-word-spacing` lives on `.word` as `margin` (or as flex `gap` on the parent);
      `--tscaps-line-spacing` on `.line + .line` as `margin-top` (or as `gap` for column
      layouts); `--tscaps-text-decoration` on `.word`, not `.segment`.
- [ ] `line-height` is hardcoded on `.segment`. There is no `--tscaps-line-height`.
- [ ] Every fallback reflects the template's *natural* value, not a neutral one. A template
      whose identity is heavy weight writes `var(--tscaps-font-weight, 800)`.
- [ ] Every `var(--tscaps-…)` and `var(--on-…)` reference has a sensible fallback for the case
      where the variable is unset.
- [ ] Every numeric style control declares `min` / `max` / `step`. Omitting them silently
      inherits `0 / 100 / 0.1`. → [style-controls.md](style-controls.md#declaring-a-control-of-your-own)
- [ ] Controls a primitive declares are **not** also listed in `styleControls`. Read the
      generated `controls.build.json` to see what the template ends up with.
- [ ] Controls that are only about movement carry `"group": "motion"` and the kind they move as
      their subgroup.
- [ ] No `!important` anywhere in the stylesheet. It does not make a rule strong, it makes it
      unreachable, and it silently disables every per-element control the editor offers.
      → [css-contract.md](css-contract.md#cascade-layers-and-why-important-is-banned)

## Animation

- [ ] Every animation uses pattern A or B, or has a stated reason for C or D.
      → [animation.md](animation.md#the-four-patterns)
- [ ] No `transition` declarations anywhere.
- [ ] Every `from` / `0%` keyframe is visually identical to the element's natural
      pre-animation state. A paused animation with a positive delay still leaks its `from` into
      the cascade from the moment the element mounts.
- [ ] No two animations on the same element.
- [ ] Every `animation:` shorthand spells `both` out.
- [ ] Every hand-written animation is declared with `@include declared.animation($id, $element)`,
      and `$element` names the element the rule actually addresses rather than the one whose
      clock it reads. → [animation.md](animation.md#declaring-what-you-apply)
- [ ] Nothing permanent is declared only inside keyframes. A filter, a colour, a stroke or a
      decoration that lives only there disappears the moment a user picks an entrance.
      → [animation.md](animation.md#a-look-that-lives-only-in-keyframes-disappears-when-the-animation-is-replaced)
- [ ] No state class (`word-being-narrated`, …) changes anything that feeds layout.
      → [css-contract.md](css-contract.md#state-classes)
- [ ] A template whose look does not survive being animated declares
      [`features.animation`](template-json.md#feature-opt-outs) for every ancestor kind that
      would break it.

## Rendering

- [ ] Translations smaller than 2 pixels have been verified in an exported video, not only in
      the preview. → [rendering.md](rendering.md#subpixel-rendering)
- [ ] No `px` in `box-shadow`, `text-shadow`, `border` or `outline`. Use `em` or `cqh`, so
      hairlines survive subpixel snapping at 1080p.
- [ ] `font-family` names a family the engine ships.
- [ ] Pseudo-elements on `.segment` / `.line` / `.word` / `.letter` are decorative or
      absolutely positioned in a way that does not displace inline text. The line splitter
      cannot see them. → [rendering.md](rendering.md#how-the-line-splitter-measures)
- [ ] A plate that *is* the caption — a box around the whole segment — is the segment's own
      padding and background, not a pseudo with a negative inset. The gallery tile scales
      the caption to fit by measuring its box; a large face fills the tile's height, and a
      pseudo reaching past that box is cut off by the tile. bean is built this way.
- [ ] A word filled by `background-clip: text` keeps `line-height` at or above the face's
      ink height. The fill paints only inside the word's own box, and an accented capital
      reaches about 1.0em above the baseline: Inter and Montserrat need about 1.3 for `É`
      and `Ñ` to keep their marks. Open the leading and draw the lines back together with
      a negative `--tscaps-line-spacing` default. Its text colour is `transparent`, so also
      give `text-decoration-color` a value, or the underline toggle draws nothing. An italic
      word leans past its box on the right, more so when the family ships no italic and the
      browser slants it (Inter): widen the box with `padding-right` and give the same amount
      back with `margin-right`, or the top of the last letter is cut off square. apollo
      does this.
- [ ] Under letter mode, the animations follow pattern D, the `from` keyframes match the
      `.letter` natural state, and the CSS does not assume continuous letter shaping — no
      kerning, ligatures or cursive joining apply across span boundaries.
      → [css-contract.md](css-contract.md#letter-mode)

## If the template ships a `filters.svg`

→ [filters.md](filters.md)

- [ ] Every `<filter>` has an `id`, and ids are unique inside the file.
- [ ] Filter regions (`x` / `y` / `width` / `height`) are padded generously enough to contain
      the blur, displacement or offset spread. Clipping at glyph edges looks broken.
- [ ] A spreading effect lives on `.segment` with a matching `rendering.padding`, or on
      `.word` with a region sized for the narrowest word at the far end of every control.
- [ ] No word under a filtered segment or line animates its transform. Safari paints a word
      whose transform is animating apart from its ancestors' filters, so the word springing
      in shows bare. Put the filter on the element that moves, as ren and boba do.
- [ ] An outline filter leaves the emoji out. Emoji are drawn by the device's emoji font, and
      Windows 10's already rings each one in dark ink, so a second ring reads as a heavy black
      border there. ren outlines its words and not its emoji.
- [ ] No SMIL elements (`<animate>`, `<set>`, `<animateTransform>`, `<animateMotion>`). They
      are refused at parse time and would freeze in the export anyway.
- [ ] `var()` references inside attribute values have fallbacks where a missing value would
      produce a broken render, and those fallbacks are **bare numbers** — filter scope values
      carry no unit.
- [ ] A filter meant to animate uses `var(--tscaps-tick*)` as a `feTurbulence` seed, or
      pre-defined variants stepped from CSS `@keyframes`.
- [ ] No `--` sequence inside an XML comment. Refer to a control by id (`outline-color`)
      instead of writing the custom property in prose.
- [ ] Filter composition preserves any `text-stroke` the template uses: ghosts merge *under*
      the source, not on top of it.

## Browsers

→ [browser-support.md](browser-support.md)

- [ ] The template has been checked in Chrome, Safari and Firefox, in the preview **and** in an
      exported video, against every entry in [browser-support.md](browser-support.md). The
      export breaks in places the preview does not.
- [ ] Nothing it uses is listed there without the workaround applied: no `paint-order: stroke
      fill` on a stroke that can be zero, a `will-change: opacity` on an element blending with
      the video, no font weight the face does not ship.
- [ ] Where a browser still cannot render it, `unsupportedBrowsers` names the narrowest slug
      that covers the break — `background-clip: text` declares `firefox`, `videoFrame.required`
      declares `safari-before-26` — and the template is added to the table at the end of
      browser-support.md with the reason.
