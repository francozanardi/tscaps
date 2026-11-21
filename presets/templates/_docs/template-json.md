# `template.json`

Everything about a template that is not CSS: its identity, its typography defaults, the knobs
the editor shows, how the transcript is cut into captions, and the rendering switches the
engine needs before the stylesheet is applied.

**Every field is optional except `name`.** Missing fields fall back to the same defaults the
rest of the editor uses, and unknown fields are ignored. The minimum viable file is:

```json
{ "name": "Bare" }
```

A built-in asks for two more, which `templates:contract` enforces: a `category` and a
`description`.

Guide: [../AUTHORING.md](../AUTHORING.md) · Controls: [style-controls.md](style-controls.md)

---

## Identity

```jsonc
{
  // Display name shown in the gallery. The only required field.
  "name": "Juno",

  // The one family the gallery lists this template under: "magazine", "modern", "viral",
  // "classic" or "lab". Every template is in exactly one — a look that could be argued into
  // two is filed where someone would go looking for it first. Absent means "lab", and the
  // contract refuses a name that is not one of the five. "magazine" holds the looks where the
  // type takes the frame over — an oversized word, tall stacked lines, letters blended with the
  // footage or set behind the person — which the gallery shows as clips because a caption on its
  // own does not carry them.
  "category": "viral",

  // What the captions look like and what they suit, in a sentence or two, for a reader who
  // chooses without seeing the template: a model picking a style, a program listing them, the
  // automation API's skill. Name the face and the casing, how the spoken word is marked, any
  // trademark move, and the kind of video it fits — and the familiar name when the look has one
  // ("Hormozi-style"), since that is how people ask for it. Required of every built-in by the
  // contract.
  "description": "Chunky italic Bungee uppercase with an elastic pop-in bounce and a layered 3D shadow extrusion; the active word turns bright yellow. Loud, retro look for entertainment and hype clips.",

  // The day the template joined the gallery, as "YYYY-MM-DD". For two weeks after it, the
  // gallery marks the card "New" and, while the card sits behind a family's "View all",
  // puts a dot on that link. The mark lapses on its own, so the field can stay put
  // afterwards. Absent means never marked; the contract refuses a day that does not exist.
  "addedOn": "2026-09-26",

  // Browsers this template must not be offered in, so the editor can flag it and skip it
  // during export. For templates that depend on CSS a browser gets wrong — Safari and
  // feDisplacementMap, for instance. Lowercase, one of "chrome", "edge", "firefox",
  // "safari", "opera" or "safari-before-26"; the contract refuses anything else, a
  // user-agent fragment included. "safari" is every WebKit runtime, so it covers iOS
  // Chrome and iOS Firefox too — on iOS every browser paints with WebKit.
  // "safari-before-26" is only the WebKit older than release 26: Safari 18 and older,
  // and every browser on iOS or iPadOS 18 and older. Name it instead of "safari" when
  // the template renders right from WebKit 26 on. What each browser gets wrong, and which
  // templates opt out of which, is in browser-support.md.
  "unsupportedBrowsers": ["firefox"]
}
```

## The gallery tile

```jsonc
{
  // How the gallery's tile dresses the template's name, for a look the bare name cannot carry:
  // a tag that lights it up, an emoji. The words still say the name — every card is its
  // template's name, and the contract refuses a tile that says anything else. Lines of words in
  // reading order. A word takes semantic tags by name, an emoji, and "said" on the one being said
  // when the tile is frozen — none rests on the last word. The card at rest shows that moment,
  // the hovered card plays the whole caption, and the emoji sits where the template's emoji
  // effect puts it. Only a template in a tile family shows it. Omit it to show the bare name,
  // which most templates should: a template whose look is in its type and colour reads best so.
  "tile": {
    "lines": [
      [{ "text": "Miso", "emoji": "🔥" }]
    ]
  }
}
```

## Typography defaults

What the editor's universal controls pre-fill when the user picks this template. Each field
also belongs in your stylesheet as the fallback of the matching `var(--tscaps-*)` read — see
[style-controls.md](style-controls.md).

**A template names a font stack, not a family.** A stack holds one face per writing system —
Latin, Arabic, Hebrew, Urdu, Cyrillic, Greek, Devanagari — so captions in a language you did not
design for still land on type that fits instead of on whatever the viewer's device carries. Pick
an id from [`FontStackCatalog.ts`](../../../apps/studio/src/core/fonts/domain/FontStackCatalog.ts);
the ids are the Latin face slugged (`anton`, `bebas-neue`, `eb-garamond`). The stylesheet fallback
still names the Latin family on its own, since that is what a `var()` fallback can carry.

**`fontWeight` is a weight the face ships.** Ask a face for a weight it does not have and every
browser fakes one by thickening the glyphs, Safari far more than Chrome or Firefox: the letters
widen, counters close up, and a thin outline drawn with the text disappears. Several faces ship a
single weight — Anton and Lobster ship only 400 — so check the face's package before setting a
heavier default, and pick a heavier face instead of asking for a bolder one. The same goes for a
`$font-weight` passed to `segment-typography`.

```jsonc
{
  "typography": {
    "fontStack": "bungee",      // id of a stack in FontStackCatalog.ts
    "fontSize": 3.91,           // cqh — 1cqh is 1% of video height
    "fontWeight": 400,          // 100..900 in steps of 100
    "letterSpacing": 0,         // em
    "wordSpacing": 0.12,        // em
    "lineSpacing": 0,           // em
    "textCase": "uppercase",    // "none" | "uppercase" | "lowercase"
    "textAlign": "center",      // "start" | "center" | "end", or "left" | "right"
    "italic": true,
    "underline": false,
    "strikethrough": false
  },

  // Default rotation in degrees (-180..180). Opt in by reading var(--tscaps-rotation) on
  // .segment; a template that omits the var simply ignores the rotation slider.
  "rotation": { "angleDeg": 0 }
}
```

## Placement in the frame

`*Align` picks which edge of the caption box lands on the anchor; `*Offset` is a fraction of
the video's dimension.

```jsonc
{
  "alignment": {
    "verticalAlign": "top",      // "top" | "center" | "bottom" — which edge of the box lands on the anchor
    "verticalOffset": 0.86,      // fraction of video height, ALWAYS measured from the top edge
    "horizontalAlign": "center", // "left" | "center" | "right", or "start" | "end"
    "horizontalOffset": 0.5      // fraction of video width, from the left edge
  }
}
```

`horizontalAlign` takes either vocabulary, the way `text-align` accepts both:

- **`left` / `center` / `right`** name a side of the screen, and `horizontalOffset` counts
  from the video's left edge. **This is the default choice.** Short-form players draw their
  action rail down the *right* edge — TikTok reserves roughly 120px of 1080, Reels about 90,
  while the left costs around 60. A template that hugs an edge should hug the left in every
  language, because that budget belongs to the player and not to the caption.
- **`start` / `center` / `end`** name a side of the reading order, and `horizontalOffset`
  then counts from the edge reading begins at. The two halves travel together, so `start` at
  `0.06` sits six percent in from the left in English and six percent in from the right in
  Arabic. Reach for it only when the placement is genuinely part of the reading, and weigh it
  against the rail above.

**Keep `typography.textAlign` in the same vocabulary as the anchor.** A block hugging an edge
only reads as a block when its text grows out of *that* edge, ragged edge facing inwards;
align it the other way and only the longest line reaches the edge. `levi` and `luna` are
anchored `left` and aligned `left` even in Arabic, which trades typographic convention for
the template's own shape, and the reader can undo it from the Align buttons. A block anchored
`center` has no edge to hug, so its text stays reading-relative (`start` / `end`).

The vertical axis has no equivalent. No language flips top and bottom.

Either way the user can drag the caption anywhere, and a dragged position is stored as a
screen side: a position placed with a pointer is a position on the screen.

## Splitting the transcript into captions

`segmentSplitters` is an ordered pipeline. Each entry runs on the output of the previous one.
Every config carries a `type` discriminator; every other field is optional.

Two splitters are on every template whether it lists them or not, prepended with their defaults
when missing: `speaker_change` (off by default; cuts where the speaker changes) and `cue_change`
(on by default; cuts between words read from different cues of an imported subtitle file, and
cuts nothing in a transcribed project). List one to override it or to move it.

```jsonc
{
  "segmentSplitters": [
    // Splits at hard boundary characters. mode: "none" | "sentence" | "clause" | "custom"
    // (with `chars` and optional `extends`).
    { "type": "boundary", "mode": "clause" },

    // Caps each segment at maxChars after the boundary splitter.
    { "type": "limit_by_chars", "maxChars": 28, "minChars": 6, "minDuration": 0.4, "minLastWordDuration": 0.15 },

    // Character-limit splitter that chooses every cut of a clause together, preferring cuts
    // where the words carry a high boundaryScore (populated upstream on Word) or are followed
    // by a silence. The silence adds up to pauseWeight to the score: nothing at minPause
    // seconds or less, all of it from maxPause on (defaults 0.5, 0.2, 1; pauseWeight 0 turns it
    // off). Each cut costs cutCost (default 0.4), so a cut the bounds do not need is added only
    // when it rates higher; with no signal it is the greedy split, longest chunks first. The
    // char-limit stage every built-in template uses. `boundary_score_limit_by_chars`, which
    // chose one cut at a time on the score alone, stays only for projects that stored it.
    // `cutAfterTag` (a tag expression) rates a cut right after a word that satisfies it
    // `cutAfterTagWeight` higher (default 1): a long hook breaks after its stressed word.
    { "type": "optimal_limit_by_chars", "maxChars": 14 },

    // Upper bound on the word count per segment.
    { "type": "limit_by_words", "maxWords": 6 },

    // Breaks where the inter-word silence exceeds minGap seconds.
    { "type": "pause_based", "minGap": 0.45 }
  ],

  // How a segment is broken into visible lines. Four implementations:
  //   "balanced"             — character-balanced; needs no DOM measurement.
  //                            `minCharsPerLine` refuses a break that would leave any line
  //                            shorter than it and falls back to one line fewer, down to a
  //                            single line. Absent (0) accepts every break.
  //   "balanced-pixel-width" — pixel-balanced; uses the engine's text measurer.
  //   "fixed-tail"           — reserves the last `tailWordCount` words for their own closing
  //                            line; big-last-word layouts pair it with CSS. A segment shorter
  //                            than `minWordsToSplit` (default 3, at least 2) stays on one line.
  //   "isolated-word"        — lifts one word onto the second line, alone, and marks that line
  //                            `isolated-line`, so CSS can size it as `.isolated-line` (or as
  //                            `.first-line-in-segment + .line`): the latest word with at least
  //                            `minLetters` letters that stays on screen for `minSecondsOnScreen`,
  //                            from when it is said until its caption leaves — at the next
  //                            caption, whatever sheet it belongs to, or later when `gap_free`
  //                            holds it. When none does, a
  //                            second pass takes the latest that stays `fallbackMinSecondsOnScreen`.
  //                            Words after it take a third line; when no word qualifies either way
  //                            the segment stays on one line.
  //                            The first word never qualifies. Letters are counted one by one, so
  //                            scripts that write a word in one or two characters rarely qualify.
  //                            `tagPriority` (tag expressions, e.g. ["emphasis", "accent"]) is
  //                            tried before the letters, in order: the first that finds a word on
  //                            screen long enough picks it, whatever its length. A segment none of
  //                            them finds a word in falls back to the letters.
  //                            `searchFrom: "start"` takes the earliest qualifying word instead of
  //                            the latest. `allowFirstWord: true` lets the first word qualify too,
  //                            the only word of a one-word caption included; the isolated line is
  //                            then the first, so address it as `.isolated-line`.
  //                            `minSegmentWords` lifts nothing in a caption with fewer words, and
  //                            `minLineChars` passes over a word whose lifting would leave any line
  //                            (before it, after it, or itself) shorter than that many characters.
  //                            `minPlainSegmentsBetween` keeps at least that many plain captions
  //                            between two with a lifted word, and then chooses which captions lift
  //                            together: the spaced set whose lifted words take longest to say in
  //                            total, since a speaker draws out the words they stress. Captions a
  //                            person froze by hand break the run; the choice starts again after them.
  //                            `pickBy: "spoken-duration"` lifts, within a caption, the qualifying word
  //                            that takes longest to say rather than the first in `searchFrom` order.
  //                            `onlyAtEnds: true` lifts only the caption's last word or, with
  //                            `allowFirstWord`, its first, tried in `searchFrom` order under every
  //                            other rule; one that passes neither stays on one line. A caption whose
  //                            first line is the lifted one carries `opens-with-isolated-line`.
  //                            `maxEdgeSpreadEm` (e.g. 0.15) weighs the shape of a word in the font the
  //                            lifted word is drawn in: a word whose letters end more than that many em
  //                            apart at the top (an ascender, a capital or a dot among short letters:
  //                            "bounces") is lifted only with nothing above it, as the first word; one
  //                            uneven at the bottom (a descender: "money") only as the last; one uneven
  //                            at both ("sky") only alone. Measured per letter with the browser's own
  //                            text metrics, so it follows the font and works in any script.
  "lineSplitter": {
    "type": "balanced-pixel-width",
    "maxLines": 2,
    "minLines": 1,
    "maxWidthRatio": 0.8   // line width capped at this fraction of the video width
  }
}
```

How the pixel-width splitter measures, and what it cannot see, is in
[rendering.md](rendering.md#how-the-line-splitter-measures).

## Modes

A template can design looks of its own for some of its captions, beside its body: large key phrases among
small captions, for instance. Each mode cuts its captions and breaks their lines its own way, and its words
carry the mode's template tag, which the stylesheet styles them through (`.segment:has(.word.spotlight)`)
and the person can set or clear by hand from the word tag panel. The Layout tab shows one tab per mode.

```jsonc
{
  "modes": {
    // The body: every caption no other mode takes, laid out by the top-level segmentSplitters
    // and lineSplitter. Only its name and an optional legend go here. Absent, it is called
    // "Captions". A legend says which captions are in the mode, never how they are laid out or
    // styled (the layout is the person's to change in the same tab, and a legend describing it
    // would stop being true the moment they do), and never by naming another mode. The body
    // usually needs none.
    "base": { "label": "Captions" },

    // A mode, keyed by its template tag (today only "spotlight"). It needs a label and at least
    // one matcher; a word joins it when any matcher picks it, and a word two modes pick goes to
    // the first. Matchers run when the template is applied and when the transcript is tagged:
    //   "tag-condition" — the words whose tags satisfy `condition`, a tag expression.
    // segmentSplitters and lineSplitter are the mode's own, filled in like the body's.
    "spotlight": {
      "label": "Key phrases",
      "legend": "The hook and the lines the video is built around.",
      "matchers": [{ "type": "tag-condition", "condition": "hook or peak" }],
      "segmentSplitters": [{ "type": "optimal_limit_by_chars", "maxChars": 56, "minChars": 14 }],
      "lineSplitter": { "type": "balanced-pixel-width", "maxLines": 4, "maxWidthRatio": 0.7 }
    }
  }
}
```

Applying the template takes the template tags off the sheet's words and sets them again from its matchers,
the person's own included. A template with modes is offered in the gallery only while one of its modes would take a word of
the open document: on a transcript with no hook and no peak, a template whose posters come from them
would show only its body. → [features/caption-modes.md](../../../features/caption-modes.md)

## Sounds

A template can play sounds on its words: every word a sound's `when` expression holds for gets
that sound, at the moment it is said. They are placed when the template is applied, as ordinary
effects anchored to their words, the way a graphic preset's sounds are: the person can change,
move or remove each one in the Audio tab, and switching to another template takes them away.
They are placed only while the Original track is active, since a word anchor names a word of
that track.

```jsonc
{
  "sounds": [
    // `sound` is a bundled sound's id (apps/studio/public/sounds/). `volume` is 0 to 1, absent
    // for the file's own level; `offset` is in seconds from the word's start, -10 to 10.
    // `spotlight` plays it on every word of that mode (see Modes). `minGap` passes over a word
    // said less than that many seconds after the last one that got the sound, so fast speech
    // thins the sound out rather than stacking it; 0 to 10, absent 0.
    { "when": "spotlight", "sound": "tap", "volume": 0.12, "minGap": 0.15 },

    // `alone` plays it only on a word that is the whole of its caption, under the template's
    // own cuts.
    { "when": "emphasis", "alone": true, "sound": "click", "volume": 0.3 }
  ]
}
```

A sound on every word is for words that appear one at a time, as they are said. On a caption
that shows all its words at once, the sounds land on words already on screen and read as noise.

## Effects

Document-level transformations applied between transcription and rendering. Each entry runs
only when `enabled` is true; the other sub-fields fall back to per-effect defaults.

```jsonc
{
  "effects": [
    { "type": "gap_free", "enabled": true },
    { "type": "smart_punctuation", "enabled": false },
    { "type": "emoji", "enabled": true, "placement": "segment-below", "size": 1.8, "gap": 0.1 }
  ]
}
```

Available types: `gap_free`, `remove_punctuation`, `smart_punctuation`, `smart_lowercase`,
`carry_quotes`, `emoji`. The emoji effect renders decoration glyphs next to tagged words;
`placement` is `word` | `segment-above` | `segment-below` | `segment-around`, and `size` and
`gap` are multipliers. `segment-around` lifts the glyphs into the row above or below the
caption, picked caption by caption from its position, so a run of captions scatters them; a
stylesheet can scatter them along the row too, from `--segment-index`.

## Style controls

Every entry becomes `--tscaps-<id>` on the caption wrapper, and your CSS reads it with
`var(--tscaps-<id>, <fallback>)`. The full shape, the catalogued shorthand, the groups and
what the build refuses are in [style-controls.md](style-controls.md).

```jsonc
{
  "styleControls": [
    {
      "id": "primary-color",       // becomes --tscaps-primary-color
      "label": "Text",
      "type": "color",             // "color" | "integer" | "float" | "toggle" | "select" | "text" | "image" | "font"
                                   // a "font" control's default is a stack id, like the typography one
      "default": "#ffffff",
      "group": "style",            // "style" | "motion"
      "subgroup": "colors"         // style: colors | appearance | assets · motion: segments | words | emojis
    },
    {
      "id": "shadow-depth",
      "label": "Shadow depth",
      "type": "float",
      "default": 1,
      "min": 0, "max": 2, "step": 0.1,
      "unit": "em",                // "px" | "%" | "em" | "cqh" | "cqw" | "s"
      "group": "style",
      "subgroup": "appearance",
      "legend": "How far the shadow stack extends behind each word."
    },
    {
      "id": "shadow-preset",
      "label": "Shadow style",
      "type": "select",
      "default": "hard-3d",
      "options": [
        { "value": "hard-3d",   "label": "Hard 3D",   "cssValue": "0.04em 0.04em 0 var(--tscaps-shadow-color)" },
        { "value": "soft-glow", "label": "Soft glow", "cssValue": "0 0 0.4em var(--tscaps-shadow-color)" }
      ]
    },
    {
      "id": "uppercase-overlay",
      "label": "Bold accents",
      "type": "toggle",
      "default": false,
      "valueOn": "900",                              // emitted when on
      "valueOff": "var(--tscaps-font-weight, 400)"   // emitted when off
    }
  ]
}
```

## Variants

Named presets over the template's own controls. Every override key must name a control the
template ships, whether it declared it by hand or received it from a primitive. Two or more
variants expose a preset picker in the Style tab and power the multi-speaker flow, one
variant per speaker sheet, cyclic by index. Omit for a fixed-look template.

Three rules the shipped sets follow:

- **The first variant reproduces the template's own defaults**, so a sheet that never picks
  a preset looks exactly as authored.
- **A variant moves the colour a viewer would name as the template's**, and leaves the
  structural ones alone — outline, shadow, page background, inactive word. It carries a
  second field only where one colour is expressed twice (a fill and its own halo) or where
  two only read as a pair (a chromatic-aberration offset, a text colour that ships equal to
  its highlight).
- **A preset is assigned, not browsed** — the multi-speaker flow pins one per speaker, and
  whoever sees the result reads it as how the template looks. Author to "as good as the
  default", and ship none rather than one that reads worse.

```jsonc
{
  "variants": [
    { "label": "Amber", "overrides": { "primary-color": "#ffb300", "shadow-color": "#3a2400" } },
    { "label": "Cyan",  "overrides": { "primary-color": "#4dd4ff", "shadow-color": "#062a33" } }
  ]
}
```

## Feature opt-outs

Every flag defaults to true. Declare an entry only where the template does **not** support the
feature.

```jsonc
{
  "features": {
    // A windowed layout that breaks under per-word rotation.
    "rotation": { "segment": true, "word": false },

    // A look that does not survive being animated. Keyed by the kind an animation would land
    // on, so name every ancestor of the element that breaks — for a blend on .word, that is
    // segment and line.
    "animation": { "segment": false, "line": false },

    // A layout built from one edge of the caption box: the anchor stays the one
    // alignment.verticalAlign declares.
    "anchor": { "vertical": false }
  }
}
```

`animation` exists because `mix-blend-mode` mixes against its backdrop inside the parent
stacking context, and every entrance in the library animates `transform` or `opacity` —
either of which puts a stacking context on the ancestor and cuts the blend. Measured in both
engines: even `translateY(0)` isolates, Firefox isolates on an animated `opacity` where
Chromium does not, and the frozen-frame model keeps the fill applied, so the blend never
comes back. The panels for the named kinds lock with the reason rather than offering a choice
that would break the look, and the action refuses one even if it arrives another way. luna,
milo, luca and suki blend today, and all four already opt out of `rotation` for the same reason.

**A blending element also carries `will-change: opacity`.** In the preview, Safari mixes it
against the video only while it has a compositing layer of its own, and an entrance gives it one
only while it runs: once the entrance ends, the word paints flat white. Chrome and Firefox blend
either way. `opacity` rather than `transform`: a layer promoted for `transform` keeps the scale it
was painted at, which softens a word whose entrance scales it (see `history/style-system.md`).

`anchor` exists for a layout that sizes space from where one edge of the caption landed. suki
reads `--segment-anchor-y` as its bottom edge, to keep the big word at `headline-y` above it; pinned
by its centre, the same formula puts the word somewhere else and pulls the small words up to it.
Otherwise the editor picks the anchor from where the caption is dropped, and a box as tall as
suki's lands its centre in the middle of the frame wherever it goes. With `vertical: false` the
anchor stays the one `alignment.verticalAlign` declares: a drag moves the caption along it, the
Position panel offers only that row of its anchor picker, and the action refuses any other. Make the
CSS work from any anchor instead where it can: pastor undoes `--segment-anchor-origin-y` with a
`translate` on `.segment` and needs no flag. suki cannot, because that `translate` would cut its
blend.

`briefSceneMs` is the one number among the flags: a scene on screen for less than this many
milliseconds is hidden while the caption track hides brief scenes (default `100`, `0` never
hides one). The rule exists for a second voice the transcriber squeezes between another
speaker's words. Lower it, or set `0`, where a scene is a single word — a fast word lasts as
briefly as an interjection there, and no threshold tells them apart. lewis declares `0`.

```jsonc
{ "features": { "briefSceneMs": 0 } }
```

## Rendering switches

Handled by the engine and the loader before the CSS is applied.

```jsonc
{
  "rendering": {
    // Wrap each word's text in one <span class="letter"> per grapheme.
    // See css-contract.md#letter-mode for the trade-offs.
    "splitWordsIntoLetters": false,

    // CSS padding shorthand (1 to 4 tokens). The loader generates a
    // `.segment { padding: ...; margin: -... }` rule that grows the filter's bounding box
    // without changing the visual layout. Use em so it scales with font-size; a `%` padding
    // misplaces the video-frame layer. It also widens the slice of the frame the layer
    // carries. See filters.md#giving-a-filter-room and rendering.md#the-video-frame-layer.
    "padding": "2em",

    // Opt into the video-frame layer. See rendering.md#the-video-frame-layer.
    //   previewMode "omit" (default) — no live mirror in the preview.
    //   previewMode "live"           — a <video srcObject> mirrors the player.
    //   jpegQuality [0,1]            — tunes the encoded frame slice fed to --video-frame.
    "videoFrame": { "required": true, "previewMode": "live", "jpegQuality": 0.75 }
  },

  // Opt into the text-behind-actor effect. tagCondition is a boolean tag expression scoping
  // which segments activate automatically; absent means every scene-valid segment qualifies.
  // See rendering.md#text-behind-the-actor.
  "behindActor": { "required": true, "tagCondition": "peak or hook" }
}
```
