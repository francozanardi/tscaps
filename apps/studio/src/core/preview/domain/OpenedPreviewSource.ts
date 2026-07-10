import type { PreviewVideoTrack } from '@core/preview/domain/PreviewVideoTrack';
import type { PreviewAudioTrack } from '@core/preview/domain/PreviewAudioTrack';

/**
 * A media file opened and ready for preview playback. Exposes the
 * descriptive metadata the surface needs and the two tracks the
 * pumps consume.
 *
 * `audioTrack` is `null` when the file has no audio track or its
 * audio codec is not decodable in this browser — the surface keeps
 * playing video silently in that case.
 *
 * Owns the underlying file handle. {@link dispose} aborts in-flight
 * reads and releases the handle; subsequent calls are no-ops.
 */
export interface OpenedPreviewSource {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly durationSec: number;
  readonly videoCodec: string;
  readonly videoTrack: PreviewVideoTrack;
  readonly audioTrack: PreviewAudioTrack | null;
  dispose(): void;
}
