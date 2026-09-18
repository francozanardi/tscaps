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
      is in `builtinTemplateNames()`
      ([`apps/studio/src/bootstrap/wiring/templates.ts`](../../apps/studio/src/bootstrap/wiring/templates.ts)).
      The contract check fails on an unregistered folder and on a dangling list entry.
- [ ] The folder carries only `template.json`, `style.scss` (or `style.css`), and optionally
      `filters.svg`. No `.build.*` file is committed.
- [ ] Any binary asset the CSS references lives in the shared [`_assets/`](../_assets) pool and
      is referenced as `url('asset:<filename-without-ext>')`.
      → [css-contract.md](css-contract.md#shared-assets)
- [ ] **A `key-moments` or `modern` template ships a sample clip and a poster**, as
      `apps/studio/public/templates/<id>.mp4` and `<id>.jpg`. Those two families are previewed in
      the gallery as a recorded 9:16 sample with the captions burned in, not as a rendered tile,
      and the URLs are built from the template id with no fallback, so a missing file is an empty
      card. Nothing checks this. The card shows the middle 900 rows of the sample's 1280, so
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
- [ ] Under letter mode, the animations follow pattern D, the `from` keyframes match the
      `.letter` natural state, and the CSS does not assume continuous letter shaping — no
      kerning, ligatures or cursive joining apply across span boundaries.
      → [css-contract.md](css-contract.md#letter-mode)

## If the template ships a `filters.svg`

→ [filters.md](filters.md)

- [ ] Every `<filter>` has an `id`, and ids are unique inside the file.
- [ ] Filter regions (`x` / `y` / `width` / `height`) are padded generously enough to contain
      the blur, displacement or offset spread. Clipping at glyph edges looks broken.
- [ ] A spreading effect lives on `.segment` with a matching `rendering.padding`, not on
      `.word`.
- [ ] No SMIL elements (`<animate>`, `<set>`, `<animateTransform>`, `<animateMotion>`). They
      are refused at parse time and would freeze in the export anyway.
- [ ] `var()` references inside attribute values have fallbacks where a missing value would
      produce a broken render, and those fallbacks are **bare numbers** — filter scope values
      carry no unit.
- [ ] A filter meant to animate uses `var(--tscaps-tick*)` as a `feTurbulence` seed, or
      pre-defined variants stepped from CSS `@keyframes`.
- [ ] No `--` sequence inside an XML comment. Refer to a control by id (`outline-color`)
      instead of writing the custom property in prose.
- [ ] The template has been tested in Safari if it uses `feDisplacementMap` or `feTurbulence`.
      If it does not render there, declare `"safari"` in `unsupportedBrowsers`.
- [ ] Filter composition preserves any `text-stroke` the template uses: ghosts merge *under*
      the source, not on top of it.
