# Video editing

This document describes what a render job can do besides captions: footage layers, the colour grade, the output frame, audio layers, cuts and still frames. Each section names the types it describes, and their JSDoc in the package's `.d.ts` files has the full detail.

Everything here is a field of `RenderJob`. `RenderPipelineBuilder` sets each field with one `with*` method, and `MediaBunnyRenderers` renders a job you build yourself.

## Two timelines

A render has two clocks.

- **Source time** is the input video's own time. The document's word times, `RenderJob.skipRanges` and `StillFrameSession.frameAt` use source time.
- **Output time** is the time of the file you get. `skipRanges` removes stretches of source time, so output time is shorter by their total length. Footage layers and audio layers use output time.

Each skipped range collapses to one point of the output. Video and audio inside it are dropped, and everything after it moves earlier by its length. The ranges should not overlap. The renderer sorts them. `RenderTimeMap` converts a time between the two clocks.

## Footage layers

A footage layer (`FootageLayer`) draws something over the video, from one moment of the output to another. `RenderJob.footage` (`RenderFootage`) holds the layers, a `FootageStyle` that says how they look and move, and an optional colour grade.

```ts
interface FootageLayer {
  readonly id: string;              // the name the stylesheet uses for the layer's box
  readonly source: FootageSource;   // what the layer shows
  readonly outputStartSec: number;  // output time
  readonly outputEndSec: number;    // output time
  readonly sourceStartSec: number;  // where the source starts playing
  readonly sourcePassSec: number;   // how often a video starts over; Infinity plays straight through
}
```

Layers that are active at the same moment are drawn bottom to top, in the order you give them. The source's audio is never touched: to hear a video layer, add its file as an audio layer too.

### Sources

| `source.kind` | Shows | Timing |
|---|---|---|
| `'video'` | A video file (`blob`). | It plays with the output from `sourceStartSec`, and starts over from there every `sourcePassSec`. |
| `'image'` | A still picture (`blob`). | It holds for the whole layer. |
| `'gif'` | An animated GIF (`blob`). | It plays its frames at their own pace from `sourceStartSec` of its own timeline, and loops by its own length. |
| `'source-picture'` | The input video's own picture. | The frame of the output being drawn. It has no timing of its own. |
| `'backdrop'` | The frame as drawn beneath the layer: the input's picture and every layer below. | The layer draws that frame again, in its own state, over its background colour (black where it has none). A transition between two stretches of the output is a backdrop layer that fades, blurs or moves the whole frame. |
| `'provided'` | Pictures your code draws, one for each moment of the layer (`provider`). | The engine asks for the picture at each moment. The pictures can have transparency. |

A `'provided'` source holds a `FootagePictureProvider`. Its `open(scale)` gives a `ProvidedFootagePictures`: its `width` and `height`, `pictureAt(sec)` for the picture at a moment of the layer's own time (starting at 0), `frameOf(sec)` to say which moments show the same picture, and `close()`. Use it for something no file holds, such as a page your code renders itself.

GIFs play in every browser. Where the browser's `ImageDecoder` cannot read a GIF, the engine decodes it in script.

### The stage

The engine lays a `FootageStyle` out on a stage of `frameWidth` × `frameHeight` CSS pixels. The stage is a size container, so `cqw`, `cqh` and `cqmin` are shares of the frame. A length in pixels is a pixel of the frame at that size. Whatever size the output frame has, the layer keeps its share of it.

The stage holds one box per layer, with the class `tscaps-footage-layer` and the layer's `id` in `data-tscaps-el`:

```css
[data-tscaps-el="broll"] { /* this layer's box */ }
```

The box of a layer whose source is `'source-picture'` also has the class `tscaps-footage-source-picture`. A box that no rule places covers the frame.

### Timing on the stage

Every animation on a box is paused. The engine sets it to the moment it draws through its delay, which reads the box's clock:

- `--on-layer-starts`: the seconds from the moment drawn to the moment the layer starts. It is negative once the layer has started.
- `--on-layer-ends`: the seconds from the moment drawn to the moment the layer ends.
- `--layer-duration`: how long the layer shows.

An entrance starts at `--on-layer-starts` and fills `both`. An exit ends at `--on-layer-ends`, so its delay is `calc(var(--on-layer-ends) - <duration>)`, and it fills `forwards` only. With `both`, the exit would hold its first keyframe before it starts, over the entrance.

```css
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
[data-tscaps-el="broll"] {
  animation:
    fade-in 0.3s var(--on-layer-starts) both,
    fade-out 0.3s calc(var(--on-layer-ends) - 0.3s) forwards;
}
```

A stylesheet can read the clock anywhere, and it resolves the same way. A stylesheet that reads it only in an animation's delay costs much less for each frame, because the engine can move the animations instead of writing the clock again.

The stage's own rules come first, in the `tscaps-framework` cascade layer (`CssLayer.FRAMEWORK`). Your rules, in that layer or in a later one, win over them. The only exception is the pause, which is `!important`.

### What the engine draws from a box

After the stylesheet resolves, the engine reads these values from each box and draws the layer with them. Anything else draws nothing.

- Its layout box, relative to the stage, before any transform.
- `transform`, `translate`, `rotate` and `scale`, about its `transform-origin`. A turn out of the plane draws nothing.
- `opacity`.
- In `filter`: the radius of a `blur()` and the amount of a `brightness()`.
- An `inset()` in `clip-path`, and the top-left `border-radius`.
- `object-fit` (`contain` and `scale-down` contain the picture; any other value covers the box) and `object-position`.
- `background-color`, and `--picture-fill-blur`, a length of the stage: what fills the box around a picture that is fitted inside it.
- `--clip-left`, `--clip-top`, `--clip-width`, `--clip-height` and `--clip-radius`, lengths of the stage: a rect the layer is cut to, with rounded corners. Give all four sides, or nothing is cut.
- `--video-left`, `--video-top`, `--video-width` and `--video-height`, lengths of the stage: where the input's own picture is placed while this layer shows. Give all four, or the picture stays where it is.
- `--video-above: 1` draws the input's picture in that rect right after this layer, instead of beneath every layer. `--video-radius` rounds its corners there.

### The input's own picture

Where a layer whose source is `'source-picture'` is active, the input video is drawn only by that layer, over black. This is how you place, crop, move, zoom or fade the input video over a stretch.

A video layer that covers the whole frame, with square corners and at rest, hides everything beneath it, and the engine does not draw what is hidden. A layer that fades, moves, blurs or is cut hides nothing.

## Colour grade

`RenderFootage.grade` (`FootageGrade`) changes the colour of the whole composed picture: the input video and every footage layer. It is applied beneath the captions, so it never changes them. Every value is 0 when it changes nothing.

| Field | Range | From one end to the other |
|---|---|---|
| `exposure` | -1 to 1 | One stop darker to one stop brighter. |
| `contrast` | -1 to 1 | Flat to doubled, around mid grey. |
| `saturation` | -1 to 1 | Grey to doubled colour. |
| `temperature` | -1 to 1 | Cooler (bluer) to warmer (redder). |
| `tint` | -1 to 1 | Greener to more magenta. |
| `vignette` | 0 to 1 | How far the corners get darker. |

A value outside its range is taken at the nearest end. The grade runs in a WebGL2 shader, and on a plain canvas where WebGL2 is not available.

## The output frame

- `RenderJob.frame` sets the output frame's own size, when it is not the input's size. Captions, the overlay and every footage layer are laid out on this frame. Where no layer shows the input's picture, the input video covers the frame, centered.
- `RenderJob.outputResolution` scales the frame to the size of the file. Captions are rendered at that size, so the text stays sharp. Keep its aspect ratio the same as the frame's: the renderer does not add bars or crop.
- `RenderJob.background` says what the captions are painted on: the input's frames (the default), a solid CSS colour, or nothing. Nothing gives an output with an alpha channel, and needs `outputFormat: 'webm'` (VP9 or VP8). The input still sets the output's frame rate, duration and audio.

## Audio layers

An audio layer (`AudioLayer`) mixes a sound into the output over a stretch of output time. `RenderJob.audioMix` (`RenderAudioMix`) holds the layers and the level of the input's own audio.

```ts
interface AudioLayer {
  readonly id: string;              // names the layer in errors; unique in one mix
  readonly source: Blob;            // an audio file, or a video file whose main audio track is used
  readonly outputStartSec: number;
  readonly outputEndSec: number;    // Infinity: until the source or the output ends
  readonly sourceStartSec: number;
  readonly sourcePassSec: number;   // how often it starts over; Infinity plays it once
  readonly gain: number;            // linear
  readonly fadeInSec: number;
  readonly fadeOutSec: number;      // the fade out ends where the layer ends
  readonly duck: AudioDuck | null;
}
```

- **Timing.** From `outputStartSec`, the source plays from `sourceStartSec`, and starts over from there every `sourcePassSec`. The layer stops at `outputEndSec`, at the end of the output, or, when it plays once, where its source ends: whichever comes first. Layers are placed to the sample.
- **Ducking.** An `AudioDuck` lowers the layer over some stretches of output time, for example while someone speaks. `gain` is applied over each range, multiplied with the layer's own gain. The ramp down (`attackSec`) ends where a range starts, and the ramp up (`releaseSec`) starts where it ends. Ranges closer than `attackSec + releaseSec` stay lowered between them.
- **The input's own audio.** `inputGain` is its linear level, and 0 silences it. `inputDucks` lowers or raises it over stretches, shaped like a layer's duck. At each cut, the input's audio is cut to the sample with a 5 ms fade at each edge.
- **The same curve in a live player.** `AudioGainEnvelope` turns a layer's gain, fades and duck into the breakpoints of a piecewise-linear gain. A Web Audio `GainNode` that follows those breakpoints plays the same curve the export applies.

When the mix changes the audio (it has layers, or the input's level is not 1, or the input has a duck), the output's audio is decoded, mixed and encoded again. Otherwise the input's audio is written as it is. The mix is encoded in the first compressed codec that the output container holds and the browser can encode: AAC, then Opus, in MP4. `EncodableAudioMixCodecSelector` answers the same question before a render.

When something goes wrong:

- No codec can be encoded, or the input's audio cannot be decoded: the output keeps the input's audio without the mix, and `onAudioMixDropped` says why.
- WebCodecs fails to decode the input's audio although the browser said it could: the engine decodes it through Web Audio instead and goes on, and `onAudioMixInputFallback` reports the WebCodecs error.
- A layer's source cannot be decoded: the render rejects with `AudioLayerDecodeFailedError`, unless `confirmUndecodableAudioLayers` resolves `true` to render without those layers.

`RenderJob.audio: 'discard'` leaves the input's audio out. A mix with layers still gives the output an audio track.

## Still frames

`StillFrameRenderer` paints single output frames of a job, through the same compositing a render uses. A still frame is the frame the render writes at the same moment. Nothing is encoded.

```ts
const session = await renderers.stillFrameRenderer.open(job);
const { bitmap, sourceSec, outputSec } = await session.frameAt(4);
// ...use the bitmap, then close it.
bitmap.close();
await session.close();
```

- `open(job)` reads the video's track and gets ready to paint. It rejects when the video has no video track, or when its frames cannot be decoded in this browser.
- `frameAt(sourceSec)` takes source time. For a time inside a skipped range, it paints the first frame shown after the range. The result says which source frame it shows and where that frame lands in output time.
- A session serves calls one at a time, in the order they were made. A failed call rejects alone, and the session goes on.
- `close()` frees everything the session holds.

The job's top layer and its `'provided'` footage are asked for moments in the order you ask for frames, so they must answer any order.

## Replacing parts of the renderer

`MediaBunnyRenderers` builds the default `videoRenderer` and `stillFrameRenderer`. Its `overrides` replace or watch some of their parts: the video frame decoders, the encoder and sprite-sheet probe observers, the caption renderer and the overlay renderer. Its `parts` give the pieces it built that a host can share, such as the transcode coordinator and the footage grader. The types of `overrides` and `parts`, and every part a renderer is built from, come from `@tscaps/engine/advanced`. That entry point can change in any release.
