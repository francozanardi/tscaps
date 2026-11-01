import type { VideoEncoderSelection } from '@modules/video/RenderJob';

/** A run whose default video encoder refused its probe frame, and what the run went ahead with. */
export interface DefaultVideoEncoderRefusal {
  /** The codec the run encodes with, as mediabunny names it (`'avc'`, `'vp9'`, …). */
  readonly codec: string;
  /** Output dimensions the encoder was configured for. */
  readonly width: number;
  readonly height: number;
  readonly selection: VideoEncoderSelection;
}

/**
 * Told when the browser's default video encoder refuses the probe frame
 * a run encodes before it starts, whether or not a software encoder took
 * over.
 *
 * Only a refusal is reported; a default encoder that takes the frame is
 * the common case and says nothing.
 *
 * Implementations must not throw.
 */
export interface VideoEncoderProbeObserver {
  onDefaultEncoderRefused(refusal: DefaultVideoEncoderRefusal): void;
}
