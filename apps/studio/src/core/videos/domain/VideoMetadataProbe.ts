import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';

/**
 * Reads container-level metadata from a media blob without
 * decoding the payload. Used for telemetry context and for
 * decisions that depend on the source codec/sample-rate/channel
 * count.
 *
 * Implementations are best-effort: a missing or unparseable field
 * surfaces as `null` on the returned metadata, never as a thrown
 * error. A probe call must never block the caller's main flow on
 * a recoverable failure.
 */
export interface VideoMetadataProbe {
  probe(media: Blob): Promise<VideoSourceMetadata>;
}
