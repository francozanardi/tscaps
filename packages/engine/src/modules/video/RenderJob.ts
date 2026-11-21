import type { Document } from '@modules/document/Document';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';
import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageStyle } from '@modules/video/FootageStyle';
import type { AudioDuck, AudioLayer } from '@modules/video/AudioLayer';
import type { FootageGrade } from '@modules/video/grade/FootageGrade';

export type OutputFormat = 'mp4' | 'webm';

/**
 * Footage layers to draw on the video, in output time, bottom to top,
 * and the stylesheet saying how each is drawn, resolved at every frame
 * it is active on; and a grade over the whole composed picture, beneath
 * the captions, on every frame.
 */
export interface RenderFootage {
  readonly layers: ReadonlyArray<FootageLayer>;
  readonly style: FootageStyle;
  readonly grade?: FootageGrade | undefined;
}

/** What is mixed with the input's own audio. */
export interface RenderAudioMix {
  /** Summed in any order. */
  readonly layers: ReadonlyArray<AudioLayer>;
  /** The input's own audio, linear; 0 silences it. */
  readonly inputGain: number;
  /**
   * Stretches of output time over which the input's own audio is
   * lowered or raised, on top of `inputGain`, each shaped as a layer's
   * duck is, their gains multiplied where they overlap; absent or empty
   * leaves it at `inputGain` throughout.
   */
  readonly inputDucks?: ReadonlyArray<AudioDuck>;
}

export type RenderQuality = 'low' | 'medium' | 'high' | 'very-high';

/**
 * What the captions are painted on: the input's frames, a solid CSS colour, or nothing
 * (alpha, WebM only). The input still sets the output's size, frame rate, duration and audio.
 */
export type RenderBackground =
  | { readonly kind: 'video' }
  | { readonly kind: 'color'; readonly color: string }
  | { readonly kind: 'transparent' };

/**
 * One write emitted into a `RenderJob.outputStream`: a byte slice and the
 * absolute file offset where it lands. `position` is not monotonic — the
 * muxer may seek back to patch earlier header regions once total sizes
 * are known.
 */
export interface RenderOutputChunk {
  type: 'write';
  data: Uint8Array;
  position: number;
}

/**
 * Reasons the input's audio may end up missing from the output, surfaced
 * only when the input actually had an audio track.
 */
export type AudioDiscardReason =
  /** The input had an audio track but its codec could not be identified. */
  | 'unknown-source-codec'
  /** No codec is encodable by the host that the output container can hold. */
  | 'no-encodable-target-codec';

/**
 * Reasons a mix with layers is left out of the output. The input's own
 * audio is then written as it would be without a mix.
 */
export type AudioMixDropReason =
  /** No compressed codec the output container can hold is encodable by the host. */
  | 'no-encodable-target-codec'
  /** The input's audio track cannot be decoded, so it could not be mixed without losing it. */
  | 'undecodable-input-audio';

/**
 * Information surfaced when the renderer cannot decode the input through
 * the fast (WebCodecs) path and would have to fall back to a slower
 * decoder. Lets the caller warn the user before the slow path runs.
 */
export interface FallbackDecoderInfo {
  /** Codec of the input video track that triggered the fallback. */
  inputCodec: string;
}

/**
 * Which decoder the renderer drives the input through.
 * `'html-video-element'` is the slow path, reached only when WebCodecs
 * cannot decode the input's codec.
 */
export type VideoFrameDecoderKind = 'web-codecs' | 'html-video-element' | 'packet-timing';

/** The decoder chosen for a run, and the input codec it was chosen for. */
export interface VideoFrameDecoderSelection {
  kind: VideoFrameDecoderKind;
  inputCodec: string;
}

/**
 * The encoder's hardware-acceleration hint. `'no-preference'` lets the
 * browser pick, which is a hardware encoder wherever one exists.
 */
export type VideoEncoderAcceleration = 'no-preference' | 'prefer-software';

/**
 * How the encoder for a run was chosen. Before the run starts, one frame
 * is encoded with the browser's own choice of encoder; a frame that
 * encoder refuses sends the run to a software encoder, but only once a
 * frame has gone through that one too.
 */
export interface VideoEncoderSelection {
  /** What the run's encoder was configured with. */
  acceleration: VideoEncoderAcceleration;
  /**
   * `'error-name: message'` of the probe frame the default encoder
   * refused, or `null` when it took it.
   */
  defaultEncoderFailure: string | null;
  /**
   * `'error-name: message'` of the probe frame the software encoder
   * refused, or `null` when it took it or was not tried. When set, the
   * run went ahead on the default encoder, expected to fail as its probe
   * did.
   */
  softwareEncoderFailure: string | null;
}

export interface RenderJob {
  video: Blob;
  document: Document;
  /**
   * Available styles keyed by `Section.kind`. The renderer dispatches
   * per-frame to the entry matching the active Section's `kind`.
   */
  styles: Readonly<Record<string, SubtitleStyle>>;
  /**
   * Frame-invariant HTML composited above subtitles inside the same
   * SVG `foreignObject`. Self-contained: any styling must be inline.
   */
  overlayHtml?: string;
  /**
   * Optional per-frame layer painted on top of the captions. Used by
   * effects that must occlude the caption raster (e.g. a person
   * cutout). When unset, no top layer is drawn.
   */
  topLayer?: TopLayerSource;
  /**
   * Footage drawn on this video's picture over stretches of the output.
   * Everything downstream of the frame — captions that read it, the top
   * layer — sees the composed picture.
   */
  footage?: RenderFootage;
  outputFormat?: OutputFormat;
  quality?: RenderQuality;
  /** What the captions are painted on. Defaults to the input's own frames. */
  background?: RenderBackground;
  /** `'discard'` drops the input's audio. Defaults to `'keep'` (see {@link onAudioDiscarded}). */
  audio?: 'keep' | 'discard';
  /**
   * Sounds mixed with the input's audio, and the level of that audio.
   * With at least one layer, the output's audio is decoded, mixed and
   * re-encoded, and it carries an audio track even when the input has
   * none or `audio` is `'discard'`. Without layers, an `inputGain` other
   * than 1, or an `inputDucks` entry with a range, is applied the same way —
   * decoded, scaled and re-encoded — when the input's audio is kept and
   * there is some; with an `inputGain` of 1 and no range to lower, or
   * the input's audio discarded or absent, the input's audio is handled
   * exactly as if no mix were given. A layer
   * whose source cannot be decoded rejects the render with an
   * `AudioLayerDecodeFailedError`, unless
   * `confirmUndecodableAudioLayers` lets the render go on without it.
   */
  audioMix?: RenderAudioMix;
  /**
   * Target output dimensions. When omitted, the renderer keeps the
   * input track's intrinsic display dimensions. When set, the source
   * frames are scaled to these dimensions before composition; the
   * subtitle layer is rendered directly at this size so text stays
   * crisp instead of being scaled along with the video.
   *
   * Callers are responsible for keeping the aspect ratio consistent
   * with the frame — the renderer does not letterbox or crop.
   */
  outputResolution?: { width: number; height: number };
  /**
   * The output frame's own size, where it is not the input's display
   * size; `outputResolution` then scales this frame instead. The input's
   * picture is placed in it by `footage`: drawn by the layers showing
   * the source's own picture wherever one is active, and covering the
   * frame, centred, wherever none is. Captions, the overlay and the top
   * layer are laid out on this frame.
   */
  frame?: { width: number; height: number };
  /**
   * Sink for the encoded bytes. When set, the renderer writes chunks to
   * it as the encoder produces them and `RenderResult.blob` is `null`.
   * When unset, the encoded file accumulates in memory and is returned
   * via `RenderResult.blob`.
   */
  outputStream?: WritableStream<RenderOutputChunk>;
  /**
   * Time windows (in seconds, source-time) to exclude from the
   * output. Each excluded window collapses to a single point in the
   * output timeline: video frames and audio inside the window are
   * dropped, and everything after the window is shifted earlier by
   * the window's duration. Ranges should be non-overlapping; the
   * renderer sorts them internally.
   */
  skipRanges?: ReadonlyArray<TimeRange>;
  /**
   * Abandons the render. Checked between frames, so a frame already
   * being painted finishes first; the partial output is discarded and
   * cannot be resumed. The render rejects with a `DOMException` of name
   * `'AbortError'`.
   */
  signal?: AbortSignal;
  /**
   * Called when the input had an audio track but the renderer has to
   * drop it. Not invoked when the input has no audio at all.
   */
  onAudioDiscarded?: (reason: AudioDiscardReason) => void;
  /**
   * Called when `audioMix` would change the audio but cannot be written;
   * the output then carries the input's audio as it would without a mix.
   */
  onAudioMixDropped?: (reason: AudioMixDropReason) => void;
  /**
   * Called once, with the WebCodecs error, when `audioMix` mixes the
   * input's audio and WebCodecs fails to decode it although the browser
   * said it could; the renderer then decodes it through the Web Audio
   * API and the mix goes on. Should that fail as well before anything is
   * written, {@link onAudioMixDropped} follows with
   * `undecodable-input-audio`.
   */
  onAudioMixInputFallback?: (cause: unknown) => void;
  /**
   * Called when the renderer cannot decode the input through the fast
   * (WebCodecs) path and would have to fall back to a slower decoder.
   * Resolve with `true` to continue with the fallback, `false` to abort
   * the render. When not provided, the renderer uses the fallback
   * silently. The render rejects with a `DOMException` of name
   * `'AbortError'` when the caller resolves with `false`.
   */
  confirmFallbackDecoder?: (info: FallbackDecoderInfo) => Promise<boolean>;
  /**
   * Called when some layers of `audioMix` have a source that cannot be
   * decoded, with their ids, once, after every source was tried and
   * before anything is written. Resolve with `true` to render without
   * them, `false` to reject with an `AudioLayerDecodeFailedError`
   * naming the first. When not provided, the render rejects.
   */
  confirmUndecodableAudioLayers?: (layerIds: ReadonlyArray<string>) => Promise<boolean>;
  /**
   * Called once per render, before the first frame is decoded, with the
   * decoder the renderer selected for the input. Not invoked when the
   * render fails before a decoder is chosen.
   */
  onVideoFrameDecoderSelected?: (selection: VideoFrameDecoderSelection) => void;
  /**
   * Called once per render, before the first frame is encoded, with how
   * the encoder was chosen. Not invoked when the render fails before
   * that.
   */
  onVideoEncoderSelected?: (selection: VideoEncoderSelection) => void;
}

export interface RenderResult {
  /** Encoded file in memory, or `null` when the job supplied `outputStream`. */
  blob: Blob | null;
  mimeType: string;
}

/** Progress of a render, reported once per encoded frame. */
export interface RenderProgress {
  /** `[0, 100]`. */
  percent: number;
  currentFrame: number;
  /**
   * Estimated from the output duration and the source's average frame
   * rate, so a variable-frame-rate source can end slightly off it.
   */
  totalFrames: number;
}
