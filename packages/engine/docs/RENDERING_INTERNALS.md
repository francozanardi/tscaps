# Rendering internals

This document covers the parts of `@tscaps/engine` below the pipeline: how each output frame is painted, what encodes the result, the browser limits to keep in mind, and two advanced caption features: reading the video frame in a caption style, and SVG filters. Footage layers, audio layers and still frames are in [VIDEO_EDITING.md](VIDEO_EDITING.md).

## Per-frame rendering

The engine paints captions through CSS, not through a drawing API of its own. For each output frame, it:

1. Decodes the input's frame at that moment.
2. Draws the footage layers that are active at that moment over it, each in the state its stylesheet resolves to, and applies the colour grade to the result (see [VIDEO_EDITING.md](VIDEO_EDITING.md)).
3. Builds the HTML of the captions shown at that moment. Classes such as `.segment`, `.line`, `.word` and the current state class (`word-being-narrated`, and others) are attached, so the cascade resolves to the look you wrote.
4. Wraps that HTML in an SVG `<foreignObject>`, decodes it as an image and draws it on a 2D canvas. When it can, the engine paints many frames of a caption into one large image (a sprite sheet), which saves time.
5. Composites the layers in order: the picture from step 2, the overlay HTML, the captions under the top layer, the top layer, and the captions over it. A caption with a blend mode is painted as its own layer and blended against everything beneath it.

The engine does not ship a live preview. A host can show the same caption HTML over a `<video>` element, but the export is the reference: `StillFrameRenderer` paints any output frame exactly as the export writes it.

## MediaBunny powers the encode

The default `VideoRenderer` (`MediaBunnyVideoRenderer`) is built on top of [MediaBunny](https://www.npmjs.com/package/mediabunny), a browser-side video pipeline that wraps the platform's WebCodecs primitives.

MediaBunny handles:

- Reading the input file and decoding its video frames through WebCodecs. When WebCodecs cannot decode the codec, a hidden `<video>` element decodes it instead, which is slower.
- Encoding the output through WebCodecs into an `mp4` or a `webm` file.
- Writing the input's audio: copied as it is when the container accepts its codec, encoded again when it does not, or left out when nothing fits (reported through `RenderJob.onAudioDiscarded`).
- Sending the encoded bytes to a `WritableStream` (`RenderJob.outputStream`) as they are written, instead of keeping the whole file in memory.

- Mixing audio layers with the input's audio, and encoding the mix (see [VIDEO_EDITING.md](VIDEO_EDITING.md#audio-layers)).

`MediaBunnyRenderers` builds it, and its `overrides` replace some of its parts. To replace another part, such as the `CodecPolicy` or the `AudioTrackBridgeFactory`, build the renderer yourself from the classes in `@tscaps/engine/advanced`. To use another export backend, implement `VideoRenderer` and pass it to `withVideoRenderer`.

## Browser caveats

The render depends on `<foreignObject>` and WebCodecs. Both work well in Chromium-based browsers (Chrome, Edge, Brave). Firefox and Safari are less consistent:

- **`<foreignObject>` differences.** Firefox and Safari can render some CSS differently inside `<foreignObject>` than in the page: `backdrop-filter`, long `filter` chains and complex gradients are the usual cases. If a style looks right in the page but not in the exported video on one of these browsers, check `<foreignObject>` first.
- **WebCodecs.** Available in Chromium since 94, in Safari since 16.4 and in Firefox since 130. In older versions, the render fails.
- **WebGPU, for Whisper.** Optional. `WhisperTranscriber` checks for it when it runs, and uses WebAssembly when WebGPU is not available.
- **WebGL2, for the colour grade.** Optional. Without it, the grade runs on a plain canvas.

Chromium-based browsers give the fewest surprises. Check your CSS in every browser you support before you ship it.

## Whisper model storage

`@huggingface/transformers`, the library under `WhisperTranscriber`, downloads the model files from the Hugging Face Hub. By default it keeps them in the browser's [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache), so only the first run downloads them. The default model, `base`, is about 75 MB.

`WhisperTranscriber` takes a `ModelAssetSources` as its third argument, to replace those defaults:

- `fileCache`: where the files are kept between runs. `CacheStorageModelFileCache` keeps them in the Cache API and raises `ModelFileCacheUnavailableError` when the browser refuses to store them, where the library's default only logs a warning.
- `fileFetcher`: how the files are requested. `DirectModelFileFetcher` requests each file from its own host. `RelayFallbackModelFileFetcher` asks a second host for the same file when the first one cannot be reached.
- `onnxWasmFiles`: where the inference runtime's WebAssembly files are served from, instead of a public package host.

Clearing the browser's site data clears the stored files, and the next run downloads them again. Private windows do not keep them.

## Embedding the video frame in a caption

Some caption effects need the video's pixels under the caption: refraction, frosted glass, a partial blur, a colour taken from the picture. Turn it on for one `SubtitleStyle` with `rendering.videoFrame`:

```ts
const style: SubtitleStyle = {
  // ...
  rendering: {
    splitWordsIntoLetters: false,
    videoFrame: { required: true, jpegQuality: 0.8 },
    padding: null,
    textDirection: 'ltr',
  },
};
```

When `required` is `true`, the renderer encodes the current frame as a JPEG at the given quality and sets it in the `--video-frame` CSS custom property, as `url("data:image/jpeg;base64,…")`. Use it in CSS as a `background-image`, or as an image in an SVG filter. The frame is the composed picture, with footage layers and the grade, so a caption effect reads what the viewer sees. `jpegQuality` trades encoding time for detail. The JPEG is encoded again for every frame. The engine also puts the frame in an element of the class `tscaps-video-frame-layer` inside `.segment`, placed where the caption is.

When `required` is `false` (the default), the engine does not encode the frame.

## SVG filter authoring

`SubtitleStyle.svgFilters` holds `<filter>` definitions that `SvgFilterDefinitionsParser` reads from an SVG source. Each filter gets a unique id, so several styles can declare filters with the same name.

Use a filter from CSS with `filter: url(#<name>)`. The engine replaces the name with the unique id when it renders.

Two rules apply:

- **SMIL animation elements (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`) are refused when the SVG is read.** They do not run when the SVG is decoded as an image, which is how the engine paints frames. To animate a filter, declare several versions of it and switch between them with CSS keyframes.
- **`var(--…)` inside a filter** is resolved by the engine against an `SvgFilterScope`. The scope is built for each frame and can take values from the CSS around it, so a filter setting can follow a word's state, a segment's timing or the video frame.

The JSDoc of `SvgFilter`, `SvgFilterScope` and `SvgFilterScoper` describes the scope rules in full.
