import type { Document } from '@modules/document/Document';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { TopLayerSource } from '@modules/video/mediabunny/painter/TopLayerSource';

export type OutputFormat = 'mp4' | 'webm';

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
  video: File;
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
  outputFormat?: OutputFormat;
  quality?: RenderQuality;
  /** What the captions are painted on. Defaults to the input's own frames. */
  background?: RenderBackground;
  /** `'discard'` drops the input's audio. Defaults to `'keep'` (see {@link onAudioDiscarded}). */
  audio?: 'keep' | 'discard';
  /**
   * Target output dimensions. When omitted, the renderer keeps the
   * input track's intrinsic display dimensions. When set, the source
   * frames are scaled to these dimensions before composition; the
   * subtitle layer is rendered directly at this size so text stays
   * crisp instead of being scaled along with the video.
   *
   * Callers are responsible for keeping the aspect ratio consistent
   * with the source — the renderer does not letterbox or crop.
   */
  outputResolution?: { width: number; height: number };
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
   * Called when the renderer cannot decode the input through the fast
   * (WebCodecs) path and would have to fall back to a slower decoder.
   * Resolve with `true` to continue with the fallback, `false` to abort
   * the render. When not provided, the renderer uses the fallback
   * silently. The render rejects with a `DOMException` of name
   * `'AbortError'` when the caller resolves with `false`.
   */
  confirmFallbackDecoder?: (info: FallbackDecoderInfo) => Promise<boolean>;
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
