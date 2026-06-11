# @tscaps/engine

> Burn subtitles into video in the browser. No server, no editor.

`@tscaps/engine` is a TypeScript engine that takes a video file, sources its captions (in-browser Whisper transcription, an existing `.srt`, or a hand-built `Document`), lays them out through CSS, and exports the result frame-by-frame to a new video — all client-side, with no backend involved.

The defining technical bet: **CSS is the rendering engine**. Subtitle preview is a DOM overlay above a `<video>` element. Final export samples that same CSS-styled DOM into bitmaps per frame, composited by a browser-side video pipeline. One visual artifact, two rendering paths.

## Install

```bash
npm install @tscaps/engine
```

The engine targets modern browsers (Chrome 94+, Edge 94+, Safari 16.4+, Firefox 130+) and requires WebCodecs, Web Audio, and Canvas APIs. Node ≥20 is needed only for development tooling; the engine itself does not run in Node.

## Quick start

The minimum-viable consumer: feed a video in, get back a captioned `Blob`. With no transcriber supplied, the engine downloads a Whisper model on first run (~80MB, cached after) and transcribes the audio itself.

```ts
import { RenderPipelineBuilder } from '@tscaps/engine';

const inputVideo: Blob = /* from a file input, fetch, etc. */;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .build();

const { blob } = await pipeline.run();
// `blob` is a Blob containing the captioned mp4
```

## Examples

The examples below build on each other and share two fixtures so each variation is easy to compare side by side:

**The clip** — a short demo video the engine renders captions onto:

![Input clip](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/demo.gif)

**The SRT** — caption text and cue timings used as input to `SrtTranscriber` throughout:

```srt
1
00:00:00,500 --> 00:00:02,500
Welcome to the engine.

2
00:00:02,500 --> 00:00:05,500
Captions burned in the browser.

3
00:00:05,500 --> 00:00:08,000
No server, no editor.
```

### 1. From an SRT file

Feed the engine a hand-authored `.srt`. `SrtTranscriber` parses cues into a `Document` and skips the Whisper model entirely. Default styling: bold white text, bottom-center, with a soft shadow.

```ts
import { RenderPipelineBuilder, SrtTranscriber } from '@tscaps/engine';

const srt = await (await fetch('/captions.srt')).text();

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .build();

const { blob } = await pipeline.run();
```

![Default styling](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-from-srt.gif)

### 2. Custom caption style

Hand the pipeline a CSS string. The default selectors are `.segment`, `.line`, and `.word`; the engine attaches those classes to the rendered DOM. Container units (`cqh`, `cqw`) scale sizes against the video frame. `-webkit-text-stroke` paired with `paint-order: stroke fill` paints the outline outside the glyph instead of bleeding into it.

```ts
const captionCss = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    color: #ffd400;
    -webkit-text-stroke: 0.06em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.2;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; margin: 0 0.15em; }
`;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .withCss(captionCss)
  .build();

const { blob } = await pipeline.run();
```

![Custom CSS](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-custom-css.gif)

### 3. Caption position

Captions default to bottom-center. To move them, pass an `AlignmentConfig` — fractions of the video's width and height as the anchor point, plus which edge of the caption box lands on that point.

```ts
const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .withCss(captionCss)
  .withAlignment({
    verticalAlign: 'top',
    verticalOffset: 0.12,
    horizontalAlign: 'center',
    horizontalOffset: 0.5,
  })
  .build();

const { blob } = await pipeline.run();
```

![CSS + top alignment](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-css-alignment.gif)

### 4. One word at a time (splitters)

The engine pipes the `Document` through a `SegmentSplitter` and a `LineSplitter` before rendering. Override them to force exactly one word per segment and one line per segment, then style each word as a large standalone caption.

```ts
import {
  RenderPipelineBuilder,
  SrtTranscriber,
  LimitByWordsSegmentSplitter,
} from '@tscaps/engine';

const singleWordCss = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 900;
    font-size: 11cqh;
    color: #ffffff;
    -webkit-text-stroke: 0.05em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.12em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.1;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; }
`;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .withSegmentSplitter(new LimitByWordsSegmentSplitter({ maxWords: 1 }))
  .withDefaultLineSplitterConfig({ maxLines: 1 })
  .withCss(singleWordCss)
  .build();

const { blob } = await pipeline.run();
```

![One word at a time](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-single-word.gif)

### 5. Karaoke highlight (state classes)

Every word carries a state class that reflects the current playback time: `word-not-narrated-yet`, `word-being-narrated`, or `word-already-narrated`. Target those classes in CSS to recolour each word as it plays.

```ts
const karaokeCss = `
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    -webkit-text-stroke: 0.06em #000;
    paint-order: stroke fill;
    text-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.6);
    text-align: center;
    line-height: 1.2;
  }
  .line { display: block; text-align: center; }
  .word {
    display: inline-block;
    margin: 0 0.15em;
    color: #ffffff;
  }
  .word.word-being-narrated  { color: #ffd400; }
  .word.word-already-narrated { color: #b0b0b0; }
`;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .withCss(karaokeCss)
  .build();

const { blob } = await pipeline.run();
```

![Karaoke highlight](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-karaoke.gif)

### 6. Animation driven by playback timing

The engine also exposes CSS custom properties that encode timing relative to the current frame — `--on-segment-starts`, `--on-line-being-narrated-starts`, `--word-being-narrated-duration`, and so on. Use them as `animation-delay` (or `animation-duration`) so a single keyframe rule plays in sync with the narration, frame after frame.

```ts
const slideInCss = `
  @keyframes segment-slide-in {
    from { transform: translateY(0.5em); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  .segment {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 800;
    font-size: 6cqh;
    text-align: center;
    line-height: 1.2;
    padding: 0.2em 0.6em;
    border-radius: 0.25em;
    background: rgba(255, 212, 0, 0.92);
    color: #111;
    animation: segment-slide-in 0.35s var(--on-segment-starts) ease-out both;
  }
  .line { display: block; text-align: center; }
  .word { display: inline-block; margin: 0 0.1em; }
`;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .withTranscriber(new SrtTranscriber(srt))
  .withCss(slideInCss)
  .build();

const { blob } = await pipeline.run();
```

![Slide-in animation](https://raw.githubusercontent.com/francozanardi/tscaps/main/packages/engine/docs/readme-slide-in.gif)

## Document model

Every transcriber produces a `Document` whose hierarchy is:

```
Document
└── Section[]   contiguous run, processed by one splitter + tagger chain
    └── Segment[]   one screen-sized caption block, carries a time range
        └── Line[]   one visible line of text within a segment
            └── Word[]   a word with text, time range, and tag set
```

The pipeline restructures the same `Word`s into different `Segment`s and `Line`s through `SegmentSplitter` and `LineSplitter`; the underlying word data (`text`, `time`, `tags`) does not change.

The render layer exposes that document to CSS through three surfaces: a flat set of CSS classes per element, a flat set of CSS custom properties per element, and a tag system that adds more classes via taggers. Everything the examples above target — `.word`, `.word-being-narrated`, `--on-segment-starts`, `var(--on-line-being-narrated-starts)` — comes from these surfaces.

### CSS classes the engine emits

Every rendered element carries its element class:

- `.section` — the root of the active Section
- `.segment` — a caption block
- `.line` — a visible line within a segment
- `.word` — a single word within a line
- `.letter` — a single letter within a word, emitted only when `rendering.splitWordsIntoLetters` is `true`

State classes — computed per frame from the current playback time and attached to the matching `.word` / `.line`:

- `word-not-narrated-yet`, `word-being-narrated`, `word-already-narrated`
- `line-not-narrated-yet`, `line-being-narrated`, `line-already-narrated`

Positional tags from `StructureTagger`, assigned once after splitting:

- `first-word-in-line`, `last-word-in-line`
- `first-word-in-segment`, `last-word-in-segment`
- `first-word-in-section`, `last-word-in-section`
- `first-line-in-segment`, `last-line-in-segment`
- `first-line-in-section`, `last-line-in-section`
- `first-segment-in-section`, `last-segment-in-section`
- `first-section-in-document`, `last-section-in-document`

Semantic tag classes come from `Tagger` implementations you add to the pipeline (see *Tags and taggers* below) and are entirely consumer-defined.

### CSS custom properties

Each rendered element exposes timing values relative to the current frame, so you can drive `animation-delay`, `animation-duration`, or any other CSS value from the narration timeline. `--on-…-starts` and `--on-…-ends` are seconds until the event; they go negative once the event is in the past. `--…-duration` is a span.

Element-level timing:

- `--on-section-starts`, `--on-section-ends`, `--section-duration`
- `--on-segment-starts`, `--on-segment-ends`, `--segment-duration`

Per-state timing, for both `.line` and `.word` (substitute `<elem>` with `line` or `word`):

- `--on-<elem>-not-narrated-yet-starts`, `--on-<elem>-not-narrated-yet-ends`, `--<elem>-not-narrated-yet-duration`
- `--on-<elem>-being-narrated-starts`, `--on-<elem>-being-narrated-ends`, `--<elem>-being-narrated-duration`
- `--on-<elem>-already-narrated-starts`, `--on-<elem>-already-narrated-ends`, `--<elem>-already-narrated-duration`

Letter-level, when splitting into letters:

- `--letter-index`, `--letter-count`

Layout and frame:

- `--subtitle-region-width`, `--subtitle-region-height`, `--subtitle-region-x`, `--subtitle-region-y` — the caption region's box, useful when positioning relative to the video frame
- `--video-frame` — the underlying video frame as `url("data:image/jpeg;base64,…")`, only set when `rendering.videoFrame.required` is `true` (see [docs/RENDERING_INTERNALS.md](docs/RENDERING_INTERNALS.md))

### Tags and taggers

A `Tag` is a CSS class the engine attaches to an element of the document. The engine recognises three sources:

- **Structural tags** are assigned by `StructureTagger`, which runs once after splitting and encodes each element's positional role within its container (the list above under *CSS classes*). The structural tagger is part of every default pipeline; you can target these classes without writing any tagger yourself.
- **Semantic tags** are assigned by `Tagger` implementations that pattern-match against word data. Built-ins: `RegexTagger` (matches a regex against the word text), `WordlistTagger` (membership in a set of strings), `SpanTagger` (a contiguous range of words by index). Build your own by extending the `Tagger` abstract class. Attach them through `.addTagger(...)` or `.withTaggers([...])` on the builder.
- **State tags** — `word-being-narrated`, `line-already-narrated`, etc. — are computed at render time from the current playback timestamp. They are never stored on the `Word` or `Line`; the engine just derives them per frame.

Tags map one-to-one onto CSS classes through `Tag.toCssClass()`. Unknown tag classes are silently ignored by CSS, so adding a new tag category is additive — it never breaks existing stylesheets.

## What else the engine can do

The examples above cover the common cases. The pipeline exposes more knobs you'll reach for as your needs grow:

- **Built-in transcribers**: `WhisperTranscriber` (the default, in-browser Whisper), `SrtTranscriber` (parses SubRip), `PassthroughTranscriber` (wraps a pre-built `Document`). Or implement your own by satisfying the `Transcriber` interface.
- **Segment splitters**: the default `CompositeSegmentSplitter` chains a sentence-boundary cut with a scaled-character budget. Individual strategies are exposed for custom chains — `BoundarySegmentSplitter`, `LimitByWordsSegmentSplitter`, `LimitByScaledCharsSegmentSplitter`, `PauseBasedSegmentSplitter`, `SpeakerChangeSegmentSplitter`.
- **Line splitters**: `BalancedLineSplitter` (char-balanced, no measurer needed) and `BalancedPixelWidthLineSplitter` (pixel-balanced, backed by a `TextMeasurer` — `DomProbeCanvasTextMeasurer` is the default measurer).
- **Replace any stage**: `withTranscriber`, `withSegmentSplitter`, `withLineSplitter`, `withVideoRenderer`, `withSubtitleFrameRenderer`, `withOverlayFrameRenderer`. Defaults stay in place until explicitly replaced.
- **Tweak default-stage configs without rebuilding them**: `withDefaultSegmentSplitterConfig({ maxChars, minChars, ... })`, `withDefaultLineSplitterConfig({ maxLines, maxWidthRatio, ... })`.
- **Output control**: `withOutputFormat('mp4' | 'webm')`, `withOutputResolution(width, height)`, `withQuality(...)`, `withOutputStream(...)` for streaming the encoded bytes as they're produced.
- **Per-step execution**: `runTranscriptionStep`, `runSplittingStep`, `runStructuralTaggingStep`, `runSemanticTaggingStep`, `runEffectsStep`, `runRenderingStep`. Useful when you want to inspect or hand-edit the `Document` between stages — `getDocument()` and `setDocument(doc)` give you read/replace access.
- **Progress reporting**: `run` accepts a callback that fires through every pipeline stage — Whisper model download, transcription, splitting, tagging, effects, and per-frame rendering progress.
- **Effects and semantic taggers**: pure document-transforming stages (smart punctuation, lowercase, regex/wordlist taggers, etc.) added via `addEffect` and `addTagger`.
- **Multi-style captions**: `withSubtitleStyles({ kindA: ..., kindB: ... })` for documents with multiple `Section.kind` groups, each carrying its own visual rule.

Full type definitions and inline JSDoc ship in `dist/index.d.ts`. Runnable browser and CLI consumers live in [`examples/`](examples) in the source repository.

## Going deeper

For the parts of the engine that sit below the public pipeline API — how each output frame is sampled into a bitmap via SVG `<foreignObject>`, how MediaBunny powers the encode, the browser caveats that come with that approach, how to feed the underlying video frame into your caption styles, and how SVG filters are authored — see [docs/RENDERING_INTERNALS.md](docs/RENDERING_INTERNALS.md).

## Project status

Pre-1.0. The public API surface is stabilising but may shift between minor versions until `1.0`. Pin to an exact version in production and review the changelog before upgrading.

## License

MIT — see [LICENSE](LICENSE).
