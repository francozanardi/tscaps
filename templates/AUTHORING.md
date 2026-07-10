# Authoring Templates — Reference

This is the deep technical reference. For an introduction, see [README.md](README.md).

## 1. Folder shape and discovery

A template lives at `templates/<name>/` and is a folder of static files:

```
templates/<name>/
├── template.json   # metadata, splitters, alignment, style controls
├── style.css       # subtitle-specific rules (selectors below)
└── filters.svg     # optional — SVG <filter> declarations (see §7)
```

The template folder carries only those three files. The template's id is the folder name. Every folder under `templates/` is auto-discovered at build time; adding a template is "drop the folder in". Templates appear in the gallery in directory order, and the first entry is the fallback when a saved project references an unknown template id, unless the consumer overrides the ordering.

### Shared asset pool

Binary visual assets (PNG masks, SVG textures, JPEG fills, …) live in a shared pool at `templates/_assets/`. Any file there with an accepted extension (`.png`, `.svg`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`) is bundled with a content-hashed URL and exposed to every template's CSS as `url('asset:<filename-without-ext>')`.

Example — a template that needs a watercolor mask:

```
templates/_assets/
└── marker-stroke.png       # available to all templates

templates/<name>/
├── template.json
└── style.css               # references it as url('asset:marker-stroke')
```

At template load the runtime rewrites each `asset:<id>` token to the resolved URL before the CSS is applied. An unknown id throws at load time so a missing asset surfaces immediately rather than rendering a broken template silently. The pool is shared because a mask or texture useful to one template is usually useful to others, and deduplication beats per-template copies.

### template.json schema

`template.json` declares every knob that isn't part of `style.css`: the template's name, the typography defaults, the editor's style controls, the layout pipeline (segment / line splitters, alignment), and the optional rendering switches (letter mode, filter padding, video-frame opt-in). Every field is optional except `name`; missing fields fall back to system defaults. Unknown fields are ignored.

The full schema:

```jsonc
{
  // Display name shown in the gallery.
  "name": "Juno",

  // Free-form tags. The picker derives the category tabs from the union of all templates' tags.
  "categories": ["impact"],

  // Case-insensitive substrings matched against navigator.userAgent. If any matches,
  // the template is marked unrenderable on that browser so the editor can flag it
  // and skip it during export. Use for templates that depend on CSS the browser does
  // not support correctly (e.g. Safari + feDisplacementMap).
  "unsupportedUserAgents": ["Firefox"],

  // The template's defaults for the universal typography controls. The editor's
  // sliders / pickers override each field at runtime. Missing fields fall back to
  // the global typography defaults.
  "typography": {
    "fontFamily": "Bungee",                   // any family the engine ships
    "fontSize": 3.91,                          // in cqh (1cqh = 1% of video height)
    "fontWeight": 400,                         // CSS-style 100..900 in steps of 100
    "letterSpacing": 0,                        // em
    "wordSpacing": 0.12,                       // em
    "lineSpacing": 0,                          // em
    "textCase": "uppercase",                   // "none" | "uppercase" | "lowercase"
    "textAlign": "center",                     // "left" | "center" | "right"
    "italic": true,                            // word-processor toggles
    "underline": false,
    "strikethrough": false
  },

  // Default rotation in degrees (-180..180). The template opts in by reading
  // var(--tscaps-rotation) on .segment; templates that omit the var are unaffected.
  "rotation": { "angleDeg": 0 },

  // Where the caption box sits relative to the video frame. *Align picks which edge
  // of the caption box lands on the anchor; *Offset is a fraction of the video's
  // dimension (0..1).
  "alignment": {
    "verticalAlign": "bottom",                 // "top" | "center" | "bottom"
    "verticalOffset": 0.12,                    // fraction of video height
    "horizontalAlign": "center",               // "left" | "center" | "right"
    "horizontalOffset": 0.5                    // fraction of video width
  },

  // The ordered segment-splitting pipeline. The deriver runs each entry left-to-right
  // on the output of the previous one. Every config carries a `type` discriminator;
  // every other field is optional and falls back to the descriptor's default.
  "segmentSplitters": [
    // Splits at hard boundary characters. Mode picks the boundary set:
    //   "none" | "sentence" | "clause" | "custom" (with `chars` and optional `extends`).
    { "type": "boundary", "mode": "clause" },

    // Caps each segment at maxChars after the boundary splitter; minChars/minDuration/
    // minLastWordDuration are tunable.
    { "type": "limit_by_chars", "maxChars": 28, "minChars": 6, "minDuration": 0.4, "minLastWordDuration": 0.15 },

    // Character-limit splitter that prefers cuts where the words carry a
    // high `boundaryScore` (populated upstream on `Word`). Falls back to
    // greedy (grow to maxChars, retreat if the tail would break minChars)
    // when no word in the valid range carries a score.
    { "type": "boundary_score_limit_by_chars", "maxChars": 14 },

    // Forces an upper bound on the word count per segment.
    { "type": "limit_by_words", "maxWords": 6 },

    // Breaks where the inter-word silence exceeds minGap seconds.
    { "type": "pause_based", "minGap": 0.45 }
  ],

  // The line splitter. Two implementations exist:
  //   "balanced"             — character-balanced; no DOM measurement needed.
  //   "balanced-pixel-width" — pixel-balanced; uses the engine's text measurer.
  "lineSplitter": {
    "type": "balanced-pixel-width",
    "maxLines": 2,
    "minLines": 1,
    "maxWidthRatio": 0.8                       // line width capped at this fraction of the video width
  },

  // Document-level transformations applied between transcription and rendering.
  // Each entry runs only when `enabled` is true. The other sub-fields are
  // optional and fall back to per-effect defaults. Available types: "gap_free",
  // "remove_punctuation", "smart_punctuation", "smart_lowercase", "carry_quotes".
  "effects": [
    { "type": "gap_free", "enabled": true },
    { "type": "smart_punctuation", "enabled": false }
  ],

  // Template-specific knobs exposed in the editor's style-controls panel. Each entry
  // becomes a CSS variable --tscaps-<id> on the wrapper. See §5 for the legitimate
  // patterns. The full ControlField shape:
  "styleControls": [
    {
      "id": "primary-color",                   // becomes --tscaps-primary-color
      "label": "Text",                          // shown in the editor
      "type": "color",                          // "color" | "integer" | "float" | "toggle" | "select" | "text" | "image" | "font"
      "default": "#ffffff",
      "group": "colors"                         // "colors" | "appearance" | "assets"
    },
    {
      "id": "shadow-depth",
      "label": "Shadow depth",
      "type": "float",
      "default": 1,
      "min": 0,
      "max": 2,
      "step": 0.1,
      "unit": "em",                             // "px" | "%" | "em" | "cqh" | "cqw"
      "group": "appearance",
      "advanced": false,                        // shown inside the Advanced panel when true
      "legend": "How far the shadow stack extends behind each word."
    },
    {
      "id": "shadow-preset",
      "label": "Shadow style",
      "type": "select",
      "default": "hard-3d",
      "options": [
        { "value": "hard-3d",  "label": "Hard 3D",  "cssValue": "0.04em 0.04em 0 var(--tscaps-shadow-color)" },
        { "value": "soft-glow", "label": "Soft glow", "cssValue": "0 0 0.4em var(--tscaps-shadow-color)" }
      ]
    },
    {
      "id": "uppercase-overlay",
      "label": "Bold accents",
      "type": "toggle",
      "default": false,
      "valueOn": "900",                         // emitted when the toggle is on
      "valueOff": "var(--tscaps-font-weight, 400)" // emitted when off
    }
  ],

  // Per-feature opt-outs. Every flag defaults to true; declare an entry only when
  // the template does NOT support the feature (e.g. a windowed template that breaks
  // under per-word rotation).
  "features": {
    "rotation": { "segment": true, "word": false }
  },

  // Rendering switches handled by the engine + loader before the CSS is applied.
  "rendering": {
    // When true, each .word receives a child .letter span per grapheme. See §6.5.
    "splitWordsIntoLetters": false,

    // CSS padding shorthand (1..4 tokens). The loader generates a
    // `.segment { padding: ...; margin: -... }` rule that grows the filter's
    // bounding box without changing the visual layout. Use em units so the
    // padding scales with font-size. See §7.2.
    "padding": "2em",

    // Opt into the video-frame layer (.tscaps-video-frame-layer). The frame
    // becomes accessible to the template via --video-frame and --subtitle-region-*.
    // previewMode controls how the layer behaves in the live preview:
    //   "omit" (default) — no live mirror; the template fakes the effect with
    //                       backdrop-filter or similar, or accepts a discrepancy.
    //   "live"           — a <video srcObject> mirrors the player in preview.
    // See §8.4 for the full contract.
    "videoFrame": { "required": true, "previewMode": "live" }
  }
}
```

Missing fields don't fail load — they fall back to the same defaults the rest of the editor uses (the default font and size for unset typography, no rotation, bottom-centered alignment, the default splitter pipeline, every effect off, no rendering switches). A minimum-viable `template.json` is just:

```json
{ "name": "Bare" }
```

— it inherits every default. From there you add the fields the template actually needs.

---

## 2. Document tree

Subtitles are modeled as a tree of HTML elements. A template's CSS targets these by their class names:

```
<div class="section ...">
  <div class="segment ...">
    <div class="line ...">
      <span class="word ...">Hello</span>
      <span class="word ...">world</span>
    </div>
  </div>
</div>
```

The active segment is the only one rendered at any given frame; the renderer swaps it as the playhead crosses segment boundaries.

### Per-line and per-word state classes

Each `.word` and `.line` carries one of three state classes, recomputed every frame from the playhead time:

| State | Class | When |
|---|---|---|
| Not narrated yet | `word-not-narrated-yet` / `line-not-narrated-yet` | playhead is before the word/line starts |
| Being narrated | `word-being-narrated` / `line-being-narrated` | playhead is within the word/line range |
| Already narrated | `word-already-narrated` / `line-already-narrated` | playhead has passed the word/line |

The three classes are mutually exclusive; only one is present per element per frame. State classes are added and removed as the playhead moves, so a class-scoped animation (`.word-being-narrated { animation: … }`) only runs while the class is present. If the state lasts less time than the animation duration, the animation gets cut. See [§6 Animation patterns](#6-animation-patterns) for the right way to bind animations to state changes.

### Letter-level rendering (opt-in)

Templates that need per-letter effects (typewriter, color sweeps, per-letter bounce) opt in via `template.json`:

```json
{ "rendering": { "splitWordsIntoLetters": true } }
```

When enabled, each `<span class="word">` contains one `<span class="letter">` per grapheme of the word's text:

```
<span class="word ...">
  <span class="letter">H</span>
  <span class="letter">e</span>
  <span class="letter">l</span>
  <span class="letter">l</span>
  <span class="letter">o</span>
</span>
```

Splitting is grapheme-correct: accented characters, surrogate-pair emoji, and ZWJ sequences (family emoji and similar) each form a single `.letter`. Trade-offs that come with opting in — these are inherent, not bugs:

- Kerning between adjacent letters is lost (each letter is its own text run).
- OpenType ligatures are disabled (`fi`, `fl`, …).
- Cursive scripts that rely on letter-joining (Arabic, Devanagari) are visually broken — don't use letter mode for templates intended for them.

For Latin display fonts the visual cost is minimal and the gained expressiveness is large.

### Structural tag classes

The engine adds extra classes at structural boundaries (e.g. `first-word-in-line`, `last-line-in-segment`). The full set is enumerated in the engine package README. Use them to style edges (rounded corners on the first/last word of a line, etc.).

---

## 3. Engine CSS custom properties

The engine writes a set of CSS custom properties on every rendered element. They are the primitives every animation pattern and every layout-aware effect builds on.

### Per-state timing primitives

Each state exposes three primitives:

| Variable | Value |
|---|---|
| `--on-<state>-starts` | seconds until (or since, if negative) that state begins |
| `--on-<state>-ends` | seconds until (or since, if negative) that state ends |
| `--<state>-duration` | total length of that state, in seconds (constant per element) |

Naming: `--on-…-starts` / `--on-…-ends` are *event timestamps* — they encode the moment a state begins or ends, relative to the playhead. The `on-` prefix flags them as events. `--<state>-duration` is a *span*, not an event, so it carries no `on-` prefix.

Available scopes: `section`, `segment`, `line-not-narrated-yet`, `line-being-narrated`, `line-already-narrated`, `word-not-narrated-yet`, `word-being-narrated`, `word-already-narrated`.

### Sign convention

`--on-word-being-narrated-starts` evaluates to `(word.start - currentTime)`. When the word is currently being narrated, that value is **negative** — the state already started. CSS's `animation-delay` accepts negative values to mean "the animation has been running for that long already", which is exactly how animations anchor to the playhead (see [§6](#6-animation-patterns)).

### Structural metadata

Unitless integers exposed on every render so templates can scale animations, sizes, or layout switches by per-element position and count. They carry no `--on-` prefix because they are not timestamps.

Always emitted:

| Variable | Where | Value |
|---|---|---|
| `--word-index` | on each `.word` | the word's 0-based position within its line |
| `--word-count` | on `.line` (inherited by `.word`) | number of words in the line |
| `--word-char-count` | on each `.word` | code-point length of the word's display text (surrogate-paired emoji count as 1) |
| `--last-word-char-count` | on `.line` | code-point length of the line's last word — lets a rule on `.line` (or anything ancestral) condition layout on whether the closing word is short or long without traversing to it |

Use `--word-char-count` for layouts that react to the length of a specific word — e.g. shrinking the font-size of unusually long words, or skipping a per-word geometry when the word is too short to anchor it. CSS can't branch on variable values directly, but `calc(min(1, max(0, ...)))` over a custom property gives a discrete 0/1 switch interpolable into any numeric property; non-numeric properties (e.g. `white-space`, `font-family`) need to be applied unconditionally and visually neutralized when the switch is 0.

Only when `rendering.splitWordsIntoLetters` is on:

| Variable | Where | Value |
|---|---|---|
| `--letter-index` | on each `.letter` | the letter's 0-based position within its word |
| `--letter-count` | on the parent `.word` (inherited) | number of letters in the word |

Templates derive per-letter timing by combining them with the word-level vars in a `calc()` — see Pattern D in [§6.5](#65-pattern-d--per-letter-animation-letter-mode-only).

### Layout helpers (video-frame templates)

When `template.json` declares `videoFrame.required`, the engine guarantees additional custom properties on the wrapper of every active segment:

| Variable | Value |
|---|---|
| `--video-frame` | `url(...)` of the frame slice in export; unset (resolves to `none`) in preview |
| `--subtitle-region-width` / `--subtitle-region-height` | dimensions of the slice's viewport rectangle |
| `--subtitle-region-x` / `--subtitle-region-y` | `calc()` offsets that align the layer's (0, 0) with the slice's top-left corner in the viewport |

In preview the region dimensions resolve to `100cqw` / `100cqh` (the full viewport); in export they are the cropped slice in pixels. The engine's default rule for the video-frame layer already consumes these; a template only needs to reference them if it builds its own positioning. See [§8.4](#84-templates-that-need-the-video-frame-as-a-visual-ingredient) for the full video-frame contract.

---

## 4. Universal typography variables

The editor's typography controls (font picker, size slider, italic / bold toggles, alignment, case, …) work by emitting CSS custom properties on the sheet wrapper. A template's `style.css` must read each of these via `var(--tscaps-<id>, <fallback>)`; otherwise the corresponding control is silently ignored on that template.

### Unit conventions

The subtitle overlay declares `container-type: size` on its root, so inside a template's CSS:

- `cqh` (1% of video height) is the unit for **font-size and other vertical-scale dimensions**. This follows the broadcast convention ("subtitle occupies 1/30–1/20 of vertical space"): a 16:9 horizontal renders the same template more discreetly than a 9:16 vertical of the same physical resolution, matching the TV-vs-shorts reading. Calibrate values against a 720×1280 vertical reference (1cqh ≈ 12.8px at that height).
- `cqw` (1% of video width) is the unit for **horizontal chrome dimensions** that should track the video's width — for example a fixed-width "window" frame. Calibrate against the same 720×1280 vertical reference (1cqw ≈ 7.2px at 720-wide).
- `em` (relative to the current element's font-size) is the unit for **everything that should track the text size**: padding, line-spacing, word-spacing, bg-radius, text-shadow offsets/blur, transforms in keyframes, outline thickness. When the user nudges font-size, these scale along automatically — no manual re-tuning required.
- `px` is reserved for true hairlines (a 1px border, a 2px caret).

Never hardcode font-driven dimensions in `px`: they will not scale with video size or font-size, and they will look out of proportion on videos other than the one the template was authored on.

### The variable table

Every template's `style.css` reads each of these:

| Variable | Read on | Driven by | Typical fallback |
|---|---|---|---|
| `--tscaps-font-family` | `.segment` | font autocomplete | the template's signature font |
| `--tscaps-font-size` | `.segment` | size slider | natural size in `cqh` (2–6 covers most templates at the 720×1280 vertical reference) |
| `--tscaps-font-weight` | `.segment` | bold toggle | `normal`, or the template's natural weight (`700`, `800`, `900`) |
| `--tscaps-font-style` | `.segment` | italic toggle | `normal`, or `italic` for templates that start italic |
| `--tscaps-letter-spacing` | `.segment` | letter-spacing slider | `0em` (or template's natural value) |
| `--tscaps-word-spacing` | `.word` (`margin`) or flex container (`gap`) | word-spacing slider | template's natural inter-word gap in `em` |
| `--tscaps-line-spacing` | `.line + .line` (`margin-top`) or flex container (`gap`) | line-spacing slider | template's natural inter-line gap in `em` |
| `--tscaps-text-align` | `.segment` | left/center/right control | `center` |
| `--tscaps-text-transform` | `.segment` | aA/AA/aa case control | `none`, or `uppercase` for templates that want caps by default |
| `--tscaps-text-decoration` | `.word` | underline / strikethrough toggles | `none` |
| `--tscaps-rotation` | `.segment` (`rotate` or `transform`) | rotation slider | `0deg` |

`text-decoration` lives on `.word` rather than `.segment` because it doesn't reliably propagate through `display: inline-block` descendants, and most templates wrap each word in inline-blocks for animation.

`--tscaps-rotation` is always emitted, but reading it is optional. A template that opts out (or that omits the var) simply ignores the rotation slider. The loader's missing-var warning (below) does not fire for `--tscaps-rotation` — rotation is an opt-in look, not a universal contract.

### Validation at load

The template loader scans each loaded template's CSS and emits a `console.warn` for any required var that isn't referenced. The check is a substring scan for `var(<name>` — cheap, robust to whitespace variants. A template that intentionally hardcodes a property can satisfy the check by parking the var inside a comment near its rule (`/* var(--tscaps-foo) — intentionally hardcoded */`); the normal expectation is "every template reads every universal."

### Spacing as margin

Words and lines are adjacent `<span>` / `<div>` elements with no whitespace between them — the engine renders them as discrete tagged atoms. The natural primitive for adjusting space *between* atoms is `margin`, not `line-height` (a typography concept) or `padding` (a within-box concept).

Modeling inter-element space as margin keeps the X/Y axes symmetric and prevents a "double dial" problem in BG templates: with `line-height`, sliding it up grows the pill height **and** the gap between pills at the same time. With `line-spacing` (a `margin-top` on adjacent lines), the pill height is fixed by the template's hardcoded `line-height` and the gap is its own knob. Same logic for `word-spacing` vs `word-padding-x` in templates with per-word backgrounds: padding is the pill size, margin is the gap between pills, and they need to be independent.

A typical template's `.segment` / `.line` / `.word` block:

```css
.segment {
  font-family: var(--tscaps-font-family, 'Inter');
  font-weight: var(--tscaps-font-weight, normal);
  font-style: var(--tscaps-font-style, normal);
  font-size: var(--tscaps-font-size, 2.8cqh);
  letter-spacing: var(--tscaps-letter-spacing, 0em);
  text-align: var(--tscaps-text-align, center);
  text-transform: var(--tscaps-text-transform, none);
  line-height: 1.2;                 /* hardcoded, stylistic */
  color: var(--tscaps-primary-color, #ffffff);
}

.line + .line {
  margin-top: var(--tscaps-line-spacing, 0);
}

.word {
  display: inline-block;
  margin: 0 var(--tscaps-word-spacing, 0.1em);
  text-decoration: var(--tscaps-text-decoration, none);
}
```

`line-height` is **not** a universal — each template hardcodes its own (1.0–1.6 typically) as part of its visual identity. Authors choose it once per template; users don't tune it.

---

## 5. Template-specific style controls

Anything outside the universal set goes in `template.json`'s `styleControls` array. Each entry becomes a CSS variable named `--tscaps-<id>` on the wrapper; the template's CSS reads it via `var(--tscaps-<id>, <fallback>)`.

Legitimate cases:

- `bg-padding-x` / `bg-padding-y` — pill dimensions when each word or line has a background, declared in `em` so they scale with the text. In a template where the pill IS the word's box, these are typically labelled "Word width" / "Word height".
- Shadows — the shape of a template's shadow is part of its visual identity, so each template hardcodes its own `text-shadow` and exposes only the knobs (e.g. `shadow-color`, `shadow-depth`) that make sense for that look.
- `highlight-color` — for templates that recolor `.word-being-narrated` to mark the active word. When the user enables the per-segment color rotation, the system writes to this same `--tscaps-highlight-color` variable per segment, so templates with active-word coloring get rotation support for free.

Style-control values are also exposed to `filters.svg` under the same `--tscaps-<id>` names — see [§7.3](#73-variable-substitution).

---

## 6. Animation patterns

Animations are the part of template authoring where the rules are not interchangeable. Pick the pattern that matches what you're animating; the wrong pick produces visible bugs in either the live preview or the export.

> **TL;DR — anchor animations on `.word` / `.line` / `.segment`, not on the state classes.** The structural elements live for the full segment; the state classes (`.word-being-narrated`, …) flip mid-life. Patterns A and B below put animations on the structural element with a `currentTime`-relative `animation-delay` driven by `--on-<state>-starts`. They are the recommended path. Pattern C (animations on a state class) is a fringe case — it has a real use but rarely beats A or B in practice.

### 6.1 Frame-accuracy depends on `animation-play-state: paused`

The renderer (both the live overlay and the export pipeline) injects `animation-play-state: paused` and `animation-fill-mode: both` on every segment, line, and word element. Animations do not run on their own wall-clock. Their visible state is determined entirely by:

1. `animation-delay` (driven by a CSS variable)
2. `animation-fill-mode`
3. The keyframe percentages

When the playhead moves, the engine writes new values to the timing CSS variables; the browser re-resolves the paused animations and renders the new "frozen" frame. The export pipeline does the same thing in a fresh SVG per frame.

This is also why `transition` does not work. Transitions rely on real-time wall-clock interpolation between observed property changes. They cannot be paused and re-anchored to the playhead, and the export — which renders each frame as an isolated SVG — has no "previous frame" for a transition to interpolate from. For a smooth color or transform change, use a keyframe animation.

### 6.2 Pattern A — animation on `.word`, anchored to a state's start

Use when: the animation should fire when an element enters a state, and may continue past that state.

```css
.word {
  /* base = visually identical to the animation's `from` */
  opacity: 0;
  transform: translateY(14px);
  animation:
    tscaps-word-enter 0.32s
    var(--on-word-being-narrated-starts)
    ease
    forwards;
}

@keyframes tscaps-word-enter {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

The animation is declared on `.word`, not on `.word-being-narrated`. State classes flip at state boundaries; `.word` is stable for the lifetime of the element. The animation runs to completion regardless of how long the being-narrated state actually lasts.

The negative `animation-delay` (computed from `--on-word-being-narrated-starts`) positions the animation so its origin is anchored at the word's narration start. Combined with paused state, the visible frame at any given time is exactly what the animation looks like at `(playhead − word.start)` seconds from its origin.

`forwards` keeps the end state after the animation completes. If you use `both`, the from-state also fills the pre-animation phase — see [§6.6](#66-the-two-animation-cascade-trap) for why that may not be what you want.

### 6.3 Pattern B — single animation spanning the entire state duration

Use when: you want a "fade in → hold → fade out" cycle that must complete within a state of unknown duration (typical karaoke color highlight).

```css
.word {
  animation:
    tscaps-highlight-cycle
    var(--word-being-narrated-duration)   /* dynamic duration */
    var(--on-word-being-narrated-starts)
    ease-in-out
    forwards;
}

@keyframes tscaps-highlight-cycle {
  0%, 100% { color: var(--tscaps-primary-color, #fff); }
  20%, 80% { color: var(--tscaps-highlight-color, #f5c982); }
}
```

The animation runs for exactly as long as the word is being narrated (`--word-being-narrated-duration`). The `0%` and `100%` keyframes match the `.word` base state, so the pre- and post-active phases are visually identical to the base — no flash, no snap.

The `20%–80%` plateau is where the highlight is held. The proportion between fade-in/hold/fade-out is fixed in the keyframe percentages, so the actual fade-in time scales with the word's narration time. For a 0.5-second word, the fade-in is 100 ms; for a 2-second word, 400 ms. That is a deliberate trade-off — if you need a constant fade-in time regardless of word length, you need a different pattern.

### 6.4 Pattern C — animation on a state class (fringe case)

Use when: you specifically want the animation rule to **disappear** when the state ends, so the element reverts cleanly to its `.word` base without you having to write a returning `100%` keyframe. Pattern A or B covers almost every real case; pick this one only if you have a clear reason.

```css
.word-being-narrated {
  animation:
    tscaps-pulse
    var(--word-being-narrated-duration)
    var(--on-word-being-narrated-starts)
    ease
    forwards;
}
```

The delay is still required, even though the state class is added exactly at the state's start. The intuition that "no delay is needed because the class itself triggers the animation at the right moment" holds in a wall-clock system. The renderer pins every element with `animation-play-state: paused`, so animations never run on their own — their visible frame is determined entirely by `animation-delay`. With no delay (or `0s`), the paused animation is frozen at frame 0 forever. The negative, `currentTime`-relative delay is what makes the frozen frame walk through the timeline as the playhead advances.

How Pattern C differs from Pattern A:

- **Pattern A** (on `.word`): the rule applies for the lifetime of the word. `forwards` keeps the to-state visible after the animation ends, so post-state styling is the animation's last keyframe.
- **Pattern C** (on the state class): the rule applies only while the state class is present. When the state ends, the class is removed, the animation is gone, and the word reverts to its `.word` base.

In practice, Pattern A with a returning keyframe (like Pattern B's `0%` and `100%` both anchored to base) achieves the same "clean revert" result and is more discoverable. Reach for Pattern C only when the post-state cleanup is so trivial that adding it as a returning keyframe feels like noise.

### 6.5 Pattern D — per-letter animation (letter mode only)

Use when: the template has opted into `splitWordsIntoLetters` and you want each letter to fire its animation at its own moment within the word's narration window (typewriter reveal, color sweep, per-letter pop).

Declare the animation on `.letter` with a `calc()` that slices the word's narration window into `--letter-count` equal pieces and offsets each letter by `--letter-index`:

```css
.letter {
  animation:
    tscaps-typewriter 0.06s
    calc(
      var(--on-word-being-narrated-starts)
      + var(--word-being-narrated-duration) * var(--letter-index) / var(--letter-count)
    )
    ease-out
    both;
}

@keyframes tscaps-typewriter {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

For each letter, the resolved `animation-delay` lands at `(word.start + word.duration * i / N) − currentTime` — the moment the playhead reaches that letter's slice. With `both`, the from-state holds before that moment and the to-state after.

Letter mode forces the engine's frame renderer to redraw every frame. The renderer fingerprints each animation by its resolved `animation-delay` value to figure out which CSS variable it depends on. The `calc()` above mixes four different variables into one number that decodes to nothing the fingerprint recognizes, so any letter-mode segment is treated pessimistically as continuously animating. Templates that opt in accept this cost; word-level templates pay nothing.

### 6.6 The two-animation cascade trap

A natural-looking solution to "fade in then fade out" is two animations on the same element, one per direction:

```css
/* DON'T — this misbehaves under animation-play-state: paused */
.word {
  animation:
    tscaps-fade-in  0.4s var(--on-word-being-narrated-starts)  ease forwards,
    tscaps-fade-out 0.4s var(--on-word-already-narrated-starts) ease forwards;
}
```

What goes wrong: while the second animation has a positive delay (its state has not started yet), it is paused in its before-phase. Across browsers, a paused before-phase animation still contributes its first keyframe (`0%` / `from`) into the cascade. With two animations on the same element, the **second one's `from` state wins** (later in the animation list = later in the cascade). The element is locked into the second animation's from-state from the moment it mounts.

In the concrete case above the second animation's `from` is the highlighted state — every word in the segment renders as highlighted, including words that are not yet being narrated.

**Fix:** collapse to one animation that covers the whole cycle. Use Pattern B with a single keyframe sequence that walks `0% (base) → mid (highlight) → 100% (base)`, or accept an instant color swap on the state class.

**The same mechanic applies to single animations.** A `from` keyframe that doesn't match the element's natural base state leaks into the cascade from the moment the element mounts, even if the animation's real timeline window opens later. If you write `from { color: red }` and the element's base is white, every word renders red from segment mount until its narration begins. Always make sure your `from` / `0%` matches the base styles on the element it's attached to.

---

## 7. SVG filters

For effects that go beyond what CSS expresses natively — directional motion blur, real chromatic aberration, displacement noise, morphological outline, volumetric lighting, refraction of the live video — a template ships a `filters.svg` file alongside `style.css`. Each `<filter>` it declares becomes available to `style.css` via the standard `filter: url(#id)` reference. Variables inside the filter body (`var(--name)`) resolve per render tile against the same scope the template's CSS sees, plus a small set of time-derived helpers.

This unlocks the SVG filter primitive set — `feGaussianBlur`, `feDisplacementMap`, `feTurbulence`, `feMorphology`, `feSpecularLighting`, `feComposite`, `feColorMatrix`, `feMerge`, `feImage`, and the rest — under the same authoring loop as CSS.

### 7.1 File shape

`filters.svg` is a single root `<svg>` with one or more `<filter id="...">` blocks under `<defs>`:

```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shutter" x="-10%" y="-100%" width="120%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="0 var(--tscaps-blur-amount)"/>
    </filter>

    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
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

The `id` is the value `style.css` references via `filter: url(#id)`. Multiple filters can live in the same file; ids must be unique inside the file.

### 7.2 Filter region

`x` / `y` / `width` / `height` on `<filter>` define the user-space rectangle the filter renders into. The browser default of 10% padding around the source is rarely enough — filter output outside the region is silently discarded. As a rule:

- `feGaussianBlur stdDeviation="X"` spreads roughly `3 × X` pixels in each direction. Pad the region to contain that.
- `feMorphology dilate radius="X"` extends `X` pixels in each direction.
- `feOffset` shifts the image — the region must contain the source and its offset destination.

Generous values like `x="-25%" y="-25%" width="150%" height="150%"` (or larger) cover most cases. Tight regions clip the effect at glyph edges and look broken.

The source bbox itself can also be too small. Filter regions default to `filterUnits="objectBoundingBox"`, so the `x` / `y` / `width` / `height` percentages are taken relative to the filtered element's own bounding box. When the filter is applied to a text-tight element (`.segment`, `.word`) and the effect needs to reach far past the glyphs — a wide glow, a big drop shadow, a displacement that sprays outward — even generous percentages bottom out because 150% of a small box is still a small box.

The fix is to grow the host element's border-box with extra padding (which becomes the filter's bbox) and cancel it back out with a matching negative margin, so the layout footprint — position, alignment, hit-testing — stays put. Declare this in `template.json` under `rendering.padding`:

```json
{
  "rendering": {
    "padding": "2em"
  }
}
```

The value follows CSS `padding`-shorthand semantics. Length tokens pass through verbatim, so any CSS length unit works (`em`, `cqh`, `px`, `%`, …); `em` is the recommended unit because it scales with the font-size slider. Token-count semantics:

- `"1em"` — uniform on all four sides
- `"1em 2em"` — vertical / horizontal
- `"1em 2em 3em"` — top / horizontal / bottom
- `"1em 2em 3em 4em"` — top / right / bottom / left

A token count outside 1–4 throws at load time.

The loader generates a `.segment { padding: ...; margin: -... }` rule and prepends it to the template's CSS at equal selector specificity, so both the live overlay and the exporter pick it up. A template that needs different `.segment` padding for layout reasons (e.g. window chrome) can override by declaring its own `padding` rule on `.segment` — source order makes the template's rule win.

The `em` units scale with text size, so the padding tracks the font-size slider automatically. Pick a value large enough to contain the effect's reach (a glow with `stdDeviation="0.4em"` spreads ~`1.2em`; pad to `2em` to leave headroom). The filter region percentages then operate on a box that is actually big enough for the effect.

### 7.3 Variable substitution

Any attribute value in `filters.svg` may reference variables using `var(--name)` or `var(--name, fallback)`:

```svg
<feFlood flood-color="var(--tscaps-outline-color)"/>
<feGaussianBlur stdDeviation="var(--tscaps-blur, 5)"/>
<feImage href="var(--video-frame)"/>
```

The framework resolves these once per output tile against a scope assembled from three sources.

**Style controls** (`--tscaps-<id>`)

Every `styleControl` entry in `template.json` contributes one variable, keyed `--tscaps-<id>` with the raw stored value (no CSS unit suffix appended — the filter author controls units inside their attribute strings). A slider with `id: "blur-amount"` and value `5` becomes `--tscaps-blur-amount: 5` in the scope.

**Time-derived helpers** (recomputed per frame)

| Variable | Value |
|---|---|
| `--tscaps-tick` | `floor(currentTime * 30)` — integer ticking 30 times per second |
| `--tscaps-tick-60` | `floor(currentTime * 60)` — same at 60 Hz |
| `--tscaps-time` | `currentTime` as a float |

Tick variables exist because `feTurbulence`'s `seed` attribute is truncated to an integer by browsers — feeding a float would freeze the noise pattern. Tick gives a fresh integer per frame so a single `<feTurbulence seed="var(--tscaps-tick-60)">` produces a different noise pattern every frame. That is the only path to "alive" noise inside SVG filters (SMIL animations don't work — see [§7.6](#76-forbidden-smil-animation-elements)).

**Engine runtime variables** (when `videoFrame.required`)

When `template.json` declares `videoFrame.required`, the framework adds the video-frame variables (`--video-frame`, `--subtitle-region-*`) to the SVG filter scope at the same point the wrapper exposes them as CSS custom properties. The contract is documented in [§3 Layout helpers](#layout-helpers-video-frame-templates) and the consumer-side details in [§8.4](#84-templates-that-need-the-video-frame-as-a-visual-ingredient).

In export the framework crops `--video-frame` to the subtitle's painted area + a small safety bleed (or the declared `rendering.padding`), so `--subtitle-region-*` is generally a sub-rectangle of the video viewport, not the whole thing. In live preview the values span the full viewport. Either way, the rectangle they describe is the rectangle the `--video-frame` URL fills, so `feImage` / `background-image` consumers align without extra math.

These enable filters that bake the underlying video pixels into the result — refraction through the glyph silhouette, frosted-glass plates clipped to text, mix-blend compositing against the video.

**Unresolved references pass through**

If a `var(...)` references a name not in the scope and has no fallback, the framework leaves it intact in the rendered SVG. This is intentional: SVG attributes that happen to be CSS properties (`flood-color`, `lighting-color`) still resolve via normal CSS variable inheritance from the wrapper element. The framework only needs to substitute non-CSS-property attributes (`stdDeviation`, `seed`, `scale`, `dx`, `href`, …) that the browser would never resolve via CSS.

### 7.4 Referencing filters from style.css

The template's stylesheet references filters with normal CSS syntax:

```css
.word {
  filter: url(#outline);
}

.word-being-narrated {
  filter: url(#outline) url(#glow);
}

@keyframes tscaps-glitch-burst {
  0%, 4% { filter: url(#glitch); }
  5%     { filter: none; }
  6%, 9% { filter: url(#glitch); }
  10%, 100% { filter: none; }
}
```

Multiple `url(#id)` references chain in one `filter:` declaration (applied sequentially). `@keyframes` can switch between filter ids and `none` to drive on/off rhythms.

Behind the scenes the framework rewrites these references through a CSS-variable indirection so per-tile filter ids can coexist in the same render SVG without colliding. The rewrite is transparent — authors write `url(#id)` and it works.

### 7.5 Per-element vs. per-segment

`filter:` on an HTML element creates a stacking context, and the filter's output is composited at the element's bounding box. Two consequences:

**Per-element filters overlap adjacent elements.** Applying a filter to `.word` causes each word's filter output to render in that word's stacking context. The output can extend visually past the word box, but neighbor words paint *on top* in source order — visually clipping the previous word's filter on its trailing edge. For effects that need to bleed past element boundaries (broad glow, large displacement), apply the filter to `.segment` (which wraps the whole block) rather than per-word.

**Outline preservation.** Compositing filter ghosts UNDER the source (via `feMerge` with the source as the last node) preserves any `text-stroke` outline on the source — the outline is part of the source and lands on top of the ghosts. Compositing ghosts ON TOP (e.g. `feBlend mode="screen"`) tints the outline with the ghost colors and visually destroys dark outlines. Choose the composition mode based on whether the outline must remain crisp.

### 7.6 Forbidden: SMIL animation elements

`<animate>`, `<set>`, `<animateTransform>`, and `<animateMotion>` are rejected at parse time. Image-decoded SVG (which is how the export pipeline rasterizes each frame) does not tick SMIL animations — the filter freezes at the SMIL `from` state. The same template would animate in the live preview (where the SVG is in the DOM) and stay frozen in the export, breaking the "preview === export" invariant. The framework refuses this trap up front.

For time-varying filter behavior, use one of two patterns:

1. **Per-frame seed via `--tscaps-tick*`.** A single filter with `var(--tscaps-tick-60)` driving `feTurbulence seed` produces fresh noise every frame. Good for glitch, water, smoke, fire — anything stochastic.
2. **Multi-variant + CSS keyframes.** Define N filter variants in `filters.svg` (e.g. `#flicker-soft`, `#flicker-mid`, `#flicker-hard`) and have the template's `@keyframes` step between them by changing the `filter:` value. CSS doesn't interpolate between `url(#)` refs (the step is discrete), but that's exactly what gives a "flicker" rhythm.

### 7.7 What CSS already does well

Don't reach for `filters.svg` when CSS handles the effect natively:

- **Isotropic blur**: `filter: blur(Xpx)` in CSS, interpolable by CSS animations. SVG `feGaussianBlur` only wins when the blur is directional (different X / Y `stdDeviation`).
- **Drop shadow**: `text-shadow` for text, `filter: drop-shadow()` for blocks. SVG only adds value when the shadow needs morphological dilation or per-channel offsets.
- **Color tinting**: `filter: hue-rotate()`, `filter: saturate()`, `filter: brightness()`. SVG `feColorMatrix` adds value for arbitrary channel mixing.

Reach for SVG filters when the effect is genuinely beyond CSS: directional blur, lighting, displacement, true morphological outline, channel separation, refraction of an external image, custom convolution.

### 7.8 Performance: filters disable tile dedup

When a template ships a non-empty `filters.svg`, the export's tile-deduplication conservatively treats every timestamp as a unique visual state — no two frames share a rendered tile. The framework has no introspection into how the filter scope varies with time, so it assumes time-varying.

Practical impact: an export of a 30-second clip at 30 fps that would otherwise dedup heavily renders ~900 unique tiles instead of however many distinct visual states the segment had. Each tile is still batched in shared sprite-sheet SVGs, but more total bytes get decoded.

For static visual effects this is wasted work. The framework trade-off is: pay the cost so filters that DO need per-frame variation work correctly, without forcing template authors to declare "is my filter time-varying" up front. Templates that lean heavily on filters should expect somewhat slower exports.

### 7.9 Cross-browser

SVG filters are well-supported in Chrome, Firefox, and Safari for the common primitives (`feGaussianBlur`, `feColorMatrix`, `feMorphology`, `feFlood`, `feComposite`, `feMerge`, `feOffset`). Safari has had historical issues with `feDisplacementMap` and `feTurbulence` over `<foreignObject>` content — render output sometimes silently drops or paints a blank rectangle. Templates that lean on those primitives should be tested in Safari; if a template doesn't work there, declare Safari in `template.json`'s `unsupportedUserAgents` rather than shipping a broken visual.

---

## 8. Live preview vs. export differences

The live preview renders into the live DOM; the export renders each frame as an SVG-with-foreignObject and rasterizes it to a bitmap. The two paths agree on most things, with a handful of subtle differences worth knowing.

### 8.1 `transition` works in the preview, not in the export

Already covered in [§6.1](#61-frame-accuracy-depends-on-animation-play-state-paused): transitions interpolate against the previous DOM state. The export builds each frame from scratch, so there is no previous state and the transition collapses to an instant change. Avoid `transition` in template CSS.

### 8.2 Subpixel rendering

The live DOM is composited by the browser with full GPU-based subpixel positioning. A 1-pixel translation animated over 400 ms produces ~24 intermediate frames, each placed at a sub-integer pixel offset, and the movement is essentially imperceptible.

The export pipeline rasterizes the SVG to a `<canvas>` per frame. Subpixel transforms inside the SVG are honored during layout, but the rasterization to the canvas snaps to integer pixel boundaries. A 1-pixel translation over a few frames can therefore look "stepped" in the export even when it is butter-smooth in the preview.

Practical guidance:

- Don't rely on movements smaller than 2 pixels for smoothness in the export. If the visual effect must be subtle, use color, opacity, or scale changes instead of small translations.
- If the difference matters, increase the translation amplitude until it reads cleanly in the export, accepting that the preview will be slightly more visible.

The same snap-to-integer problem hits **`px`-sized shadows, borders, hairlines, and outlines.** A `1px` inset shadow that reads sharp at 480p falls between integer pixels at 1080p (where 1 CSS pixel is a smaller fraction of the rendered frame) and gets antialiased to barely visible — sometimes asymmetrically (top edge gone, bottom edge faint, corners showing artifacts). The bug only appears at high resolutions and only in export.

- Express shadow offsets, blurs, spreads, hairline borders, and outlines in `em` (or `cqh`) — never `px`. Font-size is already in `cqh`, so `em` scales with the rendered frame size automatically. A `0.04em` inset shadow renders ~2 px on a 720p export and ~3 px on a 1080p export — both above the subpixel threshold.
- This includes the drop shadow on a glass plate (`box-shadow: 0 6px 22px ...` → `0 0.15em 0.5em ...`), the 1px inner edges that form a border, and any decorative hairline.
- **SVG filter primitives are a separate case.** `feGaussianBlur stdDeviation`, `feOffset dx/dy`, and similar attributes don't accept `em` — they're in user-space pixels per SVG spec. A `stdDeviation="2"` blur in a `filters.svg` renders with the same absolute spread at 480p and 1080p, which means it's *relatively thinner* at 1080p. If the effect depends on hairline-class spreads (2–3 px range), it fades out at high resolution the same way `1px` shadows did. There's no in-CSS workaround today; bump the tuning to a value that survives at the highest target resolution.

### 8.3 Font loading

The export's SVG runs in an isolated CSS context — host page stylesheets (including the global font catalog) do not apply. The export pipeline prepends only the `@font-face` blocks for the fonts each sheet actually uses, then inlines those `woff2` files as base64 data URIs. As long as the template references a family that exists in the catalog, this is transparent.

If a template uses a font outside the families the engine ships, the export falls back to a system font. Stick to a family that the consuming app already bundles, or coordinate with the consumer to add the font before relying on it.

### 8.4 Templates that need the video frame as a visual ingredient

Some templates use the pixels of the underlying video — blurring them for a frosted-glass plate, blending words against them with `mix-blend-mode`, or refracting them through a glyph silhouette using an SVG filter's `feImage`. Both render paths converge on the same DOM hook: a `<div class="tscaps-video-frame-layer">` rendered inside the segment.

Templates declare `"videoFrame": { "required": true, ... }` in `template.json` to opt in. The framework supplies the layer's geometry and its pixel source via baseline CSS (positioning, sizing, and either the JPEG via `--video-frame` background-image in export or a live `<video srcObject>` source in preview). The template only adds the template-specific override on `.tscaps-video-frame-layer` — typically `filter`, `z-index`, or compositing properties.

**`previewMode`** controls how the preview surfaces the frame:

- `"omit"` (default): no layer is mounted live. The template handles preview itself if it wants any effect bound to the video — e.g. via `backdrop-filter` on the segment. Pay nothing in preview if you can tolerate a discrepancy or if the template's effect doesn't depend on the video pixels at all.
- `"live"`: a `<video srcObject>` mirroring the main player is mounted in place of the layer. The same CSS rule on `.tscaps-video-frame-layer` applies to both the live `<video>` in preview and the `<div>` with the JPEG background in export, so a single rule lands the same effect in both paths. Costs one extra GPU composite layer per active segment.

Pick `"live"` when the template needs the video pixels literally (filters, blends, masks). Pick `"omit"` (or leave it unset) when the template can fake the effect in preview via `backdrop-filter` or similar, or when the video pixels aren't visually load-bearing.

**Custom-property contract.** When `videoFrame.required` is set, the framework guarantees these on the wrapper of every active segment, and also injects them into the SVG filter scope (see [§7.3](#73-variable-substitution)):

- `--video-frame`: `url(...)` of the frame slice in export; unset (resolves to `none`) in preview.
- `--subtitle-region-width` / `--subtitle-region-height`: dimensions of the slice's viewport rectangle. In preview these resolve to `100cqw` / `100cqh` (the full viewport); in export they're the cropped slice in pixels.
- `--subtitle-region-x` / `--subtitle-region-y`: offsets that position the layer at the slice's top-left in viewport coordinates. The framework's default rule for the layer already consumes these; a template only needs to reference them if it builds its own positioning.

**Caveat with `"live"`.** A `<video>` element is not a URL. CSS that requires an image URL — SVG `<feImage href>`, `background-clip: text` with a URL background, `mask-image: url(...)` — only works in export, where the engine inlines the JPEG as a data URL. There's no cross-browser way today to feed a live `<video>` into those APIs. Filters whose effect depends on `var(--video-frame)` for an `feImage` source therefore appear correctly in export but silently do nothing in the preview.

### 8.5 Templates that put text behind the actor

Templates declare `"rendering": { "behindActor": { "required": true } }` in `template.json` to opt into the text-behind-actor effect: when the scene is a good fit (a person is present, the shot is steady and sharp), the actor's silhouette is composited **above** the caption, so the text appears to sit behind them. The framework owns the heavy lifting — scanning the video, caching the actor masks, and painting the cutout in both preview and export. The template only decides *when* the effect applies and *how* the caption reacts, through CSS.

**Custom-property contract.** Three custom properties, all resolved on `.segment`:

| Variable | Written by | Value |
|---|---|---|
| `--behind-actor-scene-valid` | framework, inline on the segment's wrapper | `1` while the detector approves the scene for this segment; **absent otherwise** (never `0`) |
| `--behind-actor-forced` | framework, inline on the segment's wrapper | `1` while the user forces the effect on for this segment; absent otherwise |
| `--behind-actor-active` | template CSS (baseline provides the default) | the final 0/1 decision the compositor reads |

The framework's baseline ships `.segment { --behind-actor-active: var(--behind-actor-forced, 0); }` so a user's force-on works on every template. An opt-in template overrides that rule to also follow the detector:

```css
.segment {
  --behind-actor-active: var(--behind-actor-forced, var(--behind-actor-scene-valid, 0));
}
```

Composition is the template's craft — gate it however the look demands, e.g. only on segments that carry an emphasized word (`.segment:has(.emphasis) { ... }`). The framework never encodes compound conditions; it emits the primitives and reads back `--behind-actor-active`.

**The lift is the framework's job, not the template's.** An opt-in template declares a `behind-lift` style control (a `float` in `cqh`); while the effect is active, the framework raises the caption by that amount — in the editor it translates the segment wrapper so the click target, the selection chrome, and the popover anchor all move with the text. Template CSS must **never** move the caption's geometry off the behind-actor state (`translate`, `margin`, `position`): a template-level move shifts only the painted pixels, leaving every interaction box at the un-lifted spot — the segment becomes unclickable where it is visible, and clickable where it is not.

```jsonc
// template.json — the framework reads this control as --tscaps-behind-lift.
{ "id": "behind-lift", "type": "float", "default": 30, "min": 0, "max": 55, "step": 1, "unit": "cqh" }
```

One consequence to know about: while the effect is active the wrapper carries a `translate`, which makes it a stacking context — `mix-blend-mode` on caption elements cannot blend against the live video during those segments.

**Reacting to activation — paint only.** `--behind-actor-active` is resolved by CSS, never written inline — attribute selectors like `[style*="--behind-actor-active: 1"]` will not match. Use it as a numeric 0/1 switch ([§3](#structural-metadata) describes the pattern) for paint-level reactions:

```css
.segment {
  /* Dim slightly while the actor overlaps the text. */
  opacity: calc(1 - var(--behind-actor-active) * 0.15);
}
```

**What the user sees.** Picking an opt-in template prompts a one-time in-browser scan of the video (with progress and cancel). The scan finds the scene-valid windows and caches the actor masks; a per-segment menu lets the user force the effect on or off. A segment gets `--behind-actor-scene-valid` only when its **entire** time range fits inside one valid window — segments straddling a window boundary stay off, so the effect never flickers mid-caption.

See [`noa/`](noa) for a working opt-in template.

---

## 9. Line splitter measurement

The engine's line splitter decides where to break a long segment by measuring how wide each candidate run of words would render. The measurement is analytical: typography (font, weight, size, letter/word spacing, padding, margin, text-transform) is resolved once against a hidden shadow-DOM probe, then each word's width is computed via Canvas 2D `measureText` plus per-letter spacing and per-word padding/margin contributions added arithmetically.

### What this means for pseudo-elements

The measurement looks only at the words' text strings. Anything the template paints through `::before` / `::after` pseudo-elements — pill backgrounds, gutter glyphs, decorative bars — is invisible to the splitter. That is almost always correct: purely visual extensions shouldn't bias the wrap decision toward earlier breaks.

### When this matters for a template author

If a template renders inline textual content through a pseudo whose width *should* count toward wrapping, the splitter won't see it. Concrete examples:

- An inline glyph prefix on `.line::before` that displaces text to its right (not absolutely positioned in a gutter).
- Content on `.word::before` that visually extends the word inline.

For those cases, render the glyph inside a real element (an extra wrapper or structure tag) instead of a pseudo, so its text reaches the measurer through a word.

Decorative pseudos (line-number gutters at negative `left`, title bars above the text area, carets positioned past the letter) don't need to be measured — being invisible to the splitter is the right call for them.

---

## 10. Worked examples

Three real templates from the gallery, ordered simple → advanced. Read top to bottom to see how the contracts in the previous sections compose. The full folders live under `templates/<name>/`; the code below is sometimes excerpted but each example links back to its directory for the unedited source.

### 10.1 Simple — [`juno/`](juno)

A bold italic look. One animation on `.segment` (scale pop at narration start) and one state-class rule for the active word. No SVG filters, no letter mode. Two universal vars consumed, four custom controls exposed.

`juno/template.json`:

```jsonc
{
  "name": "Juno",
  "categories": ["impact"],
  // Defaults the editor's typography controls pre-fill when the user picks this template.
  "typography": {
    "fontFamily": "Bungee",
    "fontWeight": 400,
    "fontStyle": "italic",
    "fontSize": 3.91,
    "textCase": "uppercase"
  },
  // Each entry becomes --tscaps-<id> on the wrapper, with the `default` written verbatim.
  "styleControls": [
    { "id": "primary-color",   "label": "Text",         "type": "color", "default": "#ffffff", "group": "colors" },
    { "id": "highlight-color", "label": "Active word",  "type": "color", "default": "#ffdd00", "group": "colors" },
    { "id": "shadow-color",    "label": "Shadow",       "type": "color", "default": "#000000", "group": "colors" },
    { "id": "shadow-depth",    "label": "Shadow depth", "type": "float", "default": 1, "min": 0, "max": 2, "step": 0.1, "group": "appearance" }
  ],
  "alignment": { "verticalAlign": "bottom", "verticalOffset": 0.12 }
}
```

`juno/style.css`:

```css
.segment {
  /* Universal typography vars consumed first; fallbacks reflect the template's defaults. */
  font-family: var(--tscaps-font-family, 'Bungee');
  font-weight: var(--tscaps-font-weight, 400);
  font-style: var(--tscaps-font-style, italic);
  font-size: var(--tscaps-font-size, 3.91cqh);
  text-transform: var(--tscaps-text-transform, uppercase);
  text-align: var(--tscaps-text-align, center);
  color: var(--tscaps-primary-color, #ffffff);

  /* Pattern A on the structural element. animation-delay is the engine's per-segment
     timing primitive; combined with animation-play-state: paused (injected by the
     engine), the keyframe walks in sync with the playhead. */
  animation: juno-pop-in 0.35s var(--on-segment-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.word {
  display: inline-block;
  margin: 0 var(--tscaps-word-spacing, 0.12em);

  /* Layered text-shadow stack scaled by a custom control. em units keep the
     stack proportional to the text size at every export resolution. */
  text-shadow:
    calc(0.04em * var(--tscaps-shadow-depth, 1)) calc(0.04em * var(--tscaps-shadow-depth, 1)) 0 var(--tscaps-shadow-color, #000),
    calc(0.08em * var(--tscaps-shadow-depth, 1)) calc(0.08em * var(--tscaps-shadow-depth, 1)) 0 var(--tscaps-shadow-color, #000);
}

/* State-class rule: the engine flips this class on/off per frame as the playhead
   moves through the word. Anything declared here only applies while the word is
   the active one. */
.word-being-narrated {
  color: var(--tscaps-highlight-color, #ffdd00);
}

@keyframes juno-pop-in {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.10); }
  100% { transform: scale(1); }
}
```

What to take from it: the basic shape of every template — universal vars on `.segment`, custom controls applied where they belong, one structural animation, one state-class rule.

### 10.2 Intermediate — [`kai/`](kai)

Same shape, plus an SVG filter for chromatic aberration on the active word. Shows how `filters.svg` plugs into `style.css` and how style-control values reach the filter scope.

`kai/template.json` (the relevant slice — the rest mirrors Juno):

```jsonc
{
  "name": "Kai",
  "categories": ["impact"],
  "typography": {
    "fontFamily": "Bricolage Grotesque Variable",
    "fontWeight": 800,
    "fontSize": 5.0,
    "textCase": "uppercase"
  },
  // Three colour pickers + three numeric knobs feed both the CSS and the SVG filter.
  "styleControls": [
    { "id": "primary-color",   "label": "Text",         "type": "color", "default": "#e8e8ef" },
    { "id": "highlight-color", "label": "Active word",  "type": "color", "default": "#ffffff" },
    { "id": "chroma-a",        "label": "Split A",      "type": "color", "default": "#ff2e63" },
    { "id": "chroma-b",        "label": "Split B",      "type": "color", "default": "#1fffd0" },
    { "id": "outline-color",   "label": "Edge",         "type": "color", "default": "#000000" },
    { "id": "split-x",         "label": "Split sideways","type": "float","default": 0.09,  "min": 0, "max": 0.15, "unit": "em" },
    { "id": "split-y",         "label": "Split up/down", "type": "float","default": 0.085, "min": 0, "max": 0.15, "unit": "em" },
    { "id": "edge-size",       "label": "Edge size",    "type": "float", "default": 0.025, "min": 0, "max": 0.1,  "unit": "em" }
  ]
}
```

`kai/style.css` (the parts that matter for this example):

```css
.segment { /* same shape as Juno — universal vars, no filter here */ }

.word {
  display: inline-block;
  margin: 0 var(--tscaps-word-spacing, 0.14em);
  opacity: 0.55;   /* base state: dim until the playhead reaches the word */
}

/* Pattern C on the state class. The filter url() reference activates the chroma
   filter only on the active word; once the state ends, the class is removed and
   the filter goes with it. animation-delay is still required (the engine pauses
   animations regardless of which selector they live on). */
.word-already-narrated,
.word-being-narrated {
  opacity: 1;
  color: var(--tscaps-highlight-color, #ffffff);
  filter: url(#chroma-active);
  animation-name: tscaps-chroma-jitter;
  animation-duration: var(--word-being-narrated-duration);
  animation-delay: var(--on-word-being-narrated-starts);
  animation-timing-function: steps(2, end);
  animation-fill-mode: both;
}

@keyframes tscaps-chroma-jitter {
  0%   { transform: translate(0, 0); }
  20%  { transform: translate(-0.02em, 0.012em); }
  40%  { transform: translate(0.02em, -0.012em); }
  100% { transform: translate(0, 0); }
}
```

`kai/filters.svg` (the chroma filter, abbreviated):

```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Filter region padded to contain the offset ghosts; default 10% would clip them. -->
    <filter id="chroma-active" x="-30%" y="-40%" width="160%" height="180%"
            color-interpolation-filters="sRGB">

      <!-- Lower ghost: SourceAlpha offset by (-split-x, -split-y) then tinted with chroma-b.
           var(--tscaps-split-x) and var(--tscaps-split-y) come from the styleControls;
           the engine substitutes them per-tile when the filter is rendered. -->
      <feOffset in="SourceAlpha"
                dx="-var(--tscaps-split-x, 0.045)em"
                dy="-var(--tscaps-split-y, 0.03)em"
                result="splitBShape"/>
      <feFlood flood-color="var(--tscaps-chroma-b, #1fffd0)" result="splitBInk"/>
      <feComposite in="splitBInk" in2="splitBShape" operator="in" result="splitB"/>

      <!-- Upper ghost: same primitive, opposite sign. -->
      <feOffset in="SourceAlpha"
                dx="var(--tscaps-split-x, 0.045)em"
                dy="var(--tscaps-split-y, 0.03)em"
                result="splitAShape"/>
      <feFlood flood-color="var(--tscaps-chroma-a, #ff2e63)" result="splitAInk"/>
      <feComposite in="splitAInk" in2="splitAShape" operator="in" result="splitA"/>

      <!-- Edge ring: dilated SourceAlpha tinted with the outline colour. -->
      <feMorphology in="SourceAlpha" operator="dilate"
                    radius="var(--tscaps-edge-size, 0.01)em" result="dilated"/>
      <feFlood flood-color="var(--tscaps-outline-color, #000000)" result="edgeInk"/>
      <feComposite in="edgeInk" in2="dilated" operator="in" result="edge"/>

      <!-- Composite bottom-to-top so SourceGraphic (the white text) lands on top
           of the ghosts and the edge ring — the text stays crisp. -->
      <feMerge>
        <feMergeNode in="splitB"/>
        <feMergeNode in="splitA"/>
        <feMergeNode in="edge"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
</svg>
```

What to take from it: every `--tscaps-<id>` from `styleControls` reaches the SVG filter under the same name, with no extra wiring. Padded filter regions are mandatory the moment any primitive offsets or dilates. `feMerge` with `SourceGraphic` last preserves the source crispness.

### 10.3 Advanced — letter mode, [`pico/`](pico)

Letter-mode template ([§6.5](#65-pattern-d--per-letter-animation-letter-mode-only)): each letter reveals at its own moment within the word's narration window. The full `pico` ships an IDE-window chrome (traffic lights, line numbers, title bar) too; the snippet below is just the letter-reveal mechanic.

`pico/template.json` (the relevant fields):

```jsonc
{
  "name": "Pico",
  "typography": {
    "fontFamily": "JetBrains Mono Variable",
    "fontSize": 2.81,
    "textAlign": "left"
  },
  // Opt into letter mode: the engine wraps each word's text in <span class="letter">
  // children, one per grapheme. .letter then becomes a styleable target.
  "rendering": { "splitWordsIntoLetters": true }
}
```

`pico/style.css` (the per-letter animation):

```css
.letter {
  display: inline-block;
  position: relative;
  /* Pattern D — slice the word's narration window into --letter-count equal
     pieces, offset each .letter by --letter-index. The animation runs for 0.01s
     because step-start flips the keyframes in a single frame; the only thing
     that matters is the delay landing on the right tick. */
  animation: tscaps-letter-appear 0.01s
    calc(
      var(--on-word-being-narrated-starts)
      + var(--word-being-narrated-duration) * var(--letter-index) / var(--letter-count)
    )
    step-start
    both;
}

@keyframes tscaps-letter-appear {
  from { visibility: hidden; }
  to   { visibility: visible; }
}

/* A typing caret painted on the letter that just appeared: same delay arithmetic,
   but the animation now LASTS one letter-slice so the caret moves on as soon as
   the next letter reveals. */
.letter::after {
  content: '';
  display: var(--tscaps-show-caret, none);
  position: absolute;
  left: 100%;
  top: 0.05em;
  width: 0.06em;
  height: 1em;
  background: var(--tscaps-caret-color, #aeafad);
  animation: tscaps-caret-window
    calc(var(--word-being-narrated-duration) / var(--letter-count))
    calc(
      var(--on-word-being-narrated-starts)
      + var(--word-being-narrated-duration) * var(--letter-index) / var(--letter-count)
    )
    linear
    both;
}
```

What to take from it: the Pattern D delay arithmetic is the same expression every letter-mode template uses — the four-variable `calc()` is canonical. The trade-off is that letter mode forces the engine to redraw every frame, but for typewriter / cascade effects the cost is justified.

For anything beyond the typewriter — chroma waves, per-letter pop, per-letter rotation — the pattern is identical: declare the animation on `.letter`, drive `animation-delay` from the same expression, change the keyframes.

---

## 11. Author's checklist

Before submitting a new template:

- [ ] All animations either use Pattern A or Pattern B; no `transition` declarations.
- [ ] Every `var(--tscaps-…)` and `var(--on-…)` reference has a sensible fallback for the case where the variable is unset.
- [ ] Every animation's `from` / `0%` keyframe is visually identical to the element's natural pre-animation state. A paused animation with a positive delay still leaks its `from` into the cascade from the moment the element mounts; if `from` is not the same as the base, the element renders in the wrong state before the animation's real timeline window even opens (see [§6.6](#66-the-two-animation-cascade-trap)).
- [ ] No two animations on the same element with conflicting `from` states (see [§6.6](#66-the-two-animation-cascade-trap)).
- [ ] Translations smaller than 2 pixels have been verified in an exported video, not just in the preview.
- [ ] No `px` units in `box-shadow`, `text-shadow`, `border`, or `outline` — use `em` (or `cqh`) so hairlines survive subpixel snapping at 1080p export. A `1px` shadow that looks crisp at 480p disappears at 1080p (see [§8.2](#82-subpixel-rendering)).
- [ ] If the template uses `rendering.splitWordsIntoLetters`, its animations follow Pattern D and the `from` / `0%` keyframes are visually identical to the `.letter` natural state. The CSS does not assume continuous letter shaping (no kerning / ligatures / cursive joining will apply across span boundaries).
- [ ] `font-family` references a family that the engine ships.
- [ ] `style.css` reads every universal typography var from [§4](#4-universal-typography-variables) via `var(--tscaps-<id>, <fallback>)` so the corresponding editor controls take effect. The loader emits a `console.warn` at load if any are missing, but the audit is faster than waiting for the warning. Specifically: `word-spacing` lives on `.word` as a `margin` rule (or as flex `gap` when the parent is a flex row); `line-spacing` lives on `.line + .line` as a `margin-top` rule (or on the segment as flex `gap` for column layouts); `text-decoration` lives on `.word`, not `.segment`.
- [ ] The template hardcodes `line-height` on `.segment` (it's a stylistic choice per template, not a user knob). Don't reach for `var(--tscaps-line-height)` — that variable doesn't exist.
- [ ] Fallbacks in `var(--tscaps-<universal>, <fallback>)` reflect the template's natural value (e.g. `font-weight: var(--tscaps-font-weight, 800)` for a template whose identity is heavy weight). The user's toggle still wins; the fallback only applies when the toggle is at its neutral position.
- [ ] Template-specific `styleControls` cover only knobs whose meaning is unique to *this* template (e.g. `bg-padding-x/y` when it means pill dimensions; shadow knobs; `highlight-color` for templates that recolor the active word).
- [ ] Pseudo-elements (`::before` / `::after`) on `.section` / `.segment` / `.line` / `.word` / `.letter` are decorative or absolutely positioned in a way that doesn't displace inline text. The line splitter suppresses them during measurement (see [§9](#9-line-splitter-measurement)) — if a pseudo's inline content is meant to influence wrapping, render it inside a real element instead.
- [ ] The template folder lives directly under `templates/` and its folder name is the template id. Discovery is automatic — no manual registration step.
- [ ] Any binary assets (PNG masks, SVGs, …) the CSS references live in the shared `templates/_assets/` pool and are referenced as `url('asset:<filename-without-ext>')` (see [§1](#1-folder-shape-and-discovery)). The template's own folder carries only `template.json`, `style.css`, and optionally `filters.svg`.

### If the template ships a `filters.svg` (see [§7](#7-svg-filters))

- [ ] Every `<filter>` has an `id`; ids are unique inside the file.
- [ ] Filter regions (`x` / `y` / `width` / `height`) are padded generously enough to contain blur, displacement, or offset spread — clipping at glyph edges looks broken.
- [ ] No SMIL animation elements (`<animate>`, `<set>`, `<animateTransform>`, `<animateMotion>`) — they're rejected at parse time and would freeze in export anyway.
- [ ] `var(--name)` references inside attribute values have fallbacks where a missing value would produce a broken render.
- [ ] If the filter is meant to animate, it uses `var(--tscaps-tick*)` as a `feTurbulence seed` and/or pre-defined variants stepped via CSS `@keyframes` (see [§7.6](#76-forbidden-smil-animation-elements)) — not SMIL.
- [ ] Comments inside `filters.svg` may freely mention `--` sequences (e.g. a `var(--name)` reference written as documentation): the loader strips XML comments before handing the source to the parser, so the usual XML rule against `--` in comment bodies doesn't apply here.
- [ ] The template has been tested in Safari if it uses `feDisplacementMap` or `feTurbulence`; if it doesn't render correctly there, declare Safari in `unsupportedUserAgents`.
- [ ] Filter composition preserves any `text-stroke` outline the template uses — ghosts go UNDER the source via `feMerge`, not ON TOP via `feBlend mode="screen"` (see [§7.5](#75-per-element-vs-per-segment)).
