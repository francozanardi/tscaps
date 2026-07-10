# Rendering internals

This document covers the parts of `@tscaps/engine` that sit below the public pipeline API: how each output frame is sampled into a bitmap, which browser engine powers the encode, browser caveats to keep in mind, and two advanced rendering capabilities — video-frame sampling and SVG filters.

## Per-frame rendering

The engine paints captions through CSS, not through a custom drawing API. For each output frame, it:

1. Builds (or updates) a DOM tree that represents the active `Section` at that timestamp. Classes like `.segment`, `.line`, `.word` plus the current state class (`word-being-narrated`, etc.) are attached so the cascade resolves to the visual you authored.
2. Wraps that DOM in an SVG `<foreignObject>` and converts it to a data URL.
3. Decodes the data URL as an image and draws it onto a 2D canvas. The result is a raster the size of the output video frame.
4. Hands that raster (plus the decoded source video frame, plus the optional overlay HTML) to a frame compositor, which layers them in the right order.

The same DOM tree drives the editor preview as a regular overlay above a `<video>` element. The export path samples the same artifact frame-by-frame — preview and export share their entire visual contract.

## MediaBunny powers the encode

The default `VideoRenderer` (`MediaBunnyVideoRenderer`) is built on top of [MediaBunny](https://www.npmjs.com/package/mediabunny), a browser-side video pipeline that wraps the platform's WebCodecs primitives.

MediaBunny handles:

- Demuxing the input file and decoding video frames through WebCodecs (with a fallback `HTMLVideoElement` decoder when the input codec is not supported by WebCodecs).
- Encoding the output through WebCodecs into either an `mp4` or `webm` container.
- Routing audio: passing the original audio track through when the container accepts it, transcoding it when codecs mismatch, or discarding it when nothing fits (surfaced through `RenderJob.onAudioDiscarded`).
- Streaming encoded bytes through a `WritableStream` (`RenderJob.outputStream`) instead of accumulating them in memory, for larger jobs.

Replace `MediaBunnyVideoRenderer` (or just its inner stages — `CodecPolicy`, `VideoFrameDecoderFactory`, `AudioTrackBridgeFactory`, etc.) when you need to plug a different container, a different codec policy, or an entirely different export backend.

## Browser caveats

The render path leans on `<foreignObject>` plus WebCodecs. Both are well supported in Chromium-based browsers (Chrome, Edge, recent Brave); Firefox and Safari are more uneven:

- **`<foreignObject>` rendering inconsistencies.** Firefox and Safari historically render certain CSS features inside `<foreignObject>` differently from the DOM-flat path: `backdrop-filter`, advanced `filter` chains, custom fonts that haven't finished loading, and complex gradients are the usual culprits. If a style works in the editor preview but not in the exported video on a non-Chromium browser, suspect `<foreignObject>` first.
- **WebCodecs.** Stable in Chromium since 94 and in Safari since 16.4. Firefox shipped WebCodecs in 130. Older versions throw at render time.
- **WebGPU (for Whisper acceleration).** Optional and probed at runtime by `WhisperTranscriber`; falls back to WASM when WebGPU isn't available.

For production use today, Chromium-family browsers are the path of least resistance. Cross-browser support is improving rapidly, but verify your CSS in the target browsers before shipping.

## Whisper model storage

The default `WhisperTranscriber` does not manage caching itself. Model weights are downloaded from HuggingFace Hub by `@huggingface/transformers` (the underlying library) and stored in the browser's [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache), so the first run pays the download cost (~80MB depending on the model) and subsequent runs read from cache.

Clearing the browser's site data clears the model cache — the next run downloads again. Private / incognito sessions do not retain the cache across windows.

## Embedding the video frame in a caption

Some visual effects need the underlying video pixels — refraction, frosted glass, partial blur, colour sampling. Opt in per `SubtitleStyle` via `rendering.videoFrame`:

```ts
const style: SubtitleStyle = {
  // ...
  rendering: {
    splitWordsIntoLetters: false,
    videoFrame: { required: true, jpegQuality: 0.8 },
    padding: null,
    behindActor: { required: false },
  },
};
```

When `required` is `true`, the renderer encodes the current video frame as a JPEG at the given quality and exposes it through a `--video-frame` CSS custom property whose value is `url("data:image/jpeg;base64,…")`. Reference it in CSS as a `background-image`, a CSS Houdini paint source, or an SVG image input. `jpegQuality` controls the trade-off between encode time and fidelity; the JPEG re-encodes per frame.

When `required` is `false` (the default), the engine skips the JPEG encode entirely.

## SVG filter authoring

`SubtitleStyle.svgFilters` carries `<filter>` definitions parsed from an SVG source by `SvgFilterDefinitionsParser`. Each filter is renamed to a scope-unique id, so multiple sections can declare filters with the same author-facing name without colliding.

Reference a filter from CSS via `filter: url(#<author-name>)` — the engine rewrites the id at scope materialisation time.

Two constraints to be aware of:

- **SMIL animation elements (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`) are rejected at parse time.** They do not tick when the SVG is decoded as an image, which is how the engine samples frames. Animate filter behaviour by writing CSS keyframes that swap between several pre-declared filter variants instead.
- **`var(--…)` references inside a filter body** are resolved by the engine against an `SvgFilterScope`. The scope is built per frame and can pull values from the surrounding CSS, so a filter parameter can react to per-word state, segment timing, or the embedded video frame.

For a deeper look at scope rules and the resolver lifecycle, see the inline JSDoc on `SvgFilter`, `SvgFilterScope`, and `SvgFilterScoper`.
