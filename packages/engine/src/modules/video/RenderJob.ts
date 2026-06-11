import type { Document } from '@modules/document/Document';
import type { SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';

export type OutputFormat = 'mp4' | 'webm';

export type RenderQuality = 'low' | 'medium' | 'high' | 'very-high';

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
  outputFormat?: OutputFormat;
  quality?: RenderQuality;
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
}

export interface RenderResult {
  /** Encoded file in memory, or `null` when the job supplied `outputStream`. */
  blob: Blob | null;
  mimeType: string;
}

export interface RenderProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
}
