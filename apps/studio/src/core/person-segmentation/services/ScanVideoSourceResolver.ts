import type { VideoState } from '@core/editor/domain/VideoState';

/**
 * Playable URL for a detector pass, plus the release of any resource
 * created to produce it. Call `dispose` once the scan is done with the
 * URL; for URLs the resolver did not create, `dispose` is a no-op.
 */
export interface ScanVideoSource {
  readonly url: string;
  dispose(): void;
}

/**
 * Picks the video the detector should decode. The preview proxy wins
 * whenever it exists: MediaPipe works at ~256px internally, so masks
 * derived from the 480p proxy match the original's precision while
 * seeking and decoding orders of magnitude less data. The original is
 * only a fallback for sessions running without the proxy pipeline.
 * Returns `null` when no playable source is loaded.
 */
export class ScanVideoSourceResolver {

  resolve(video: VideoState): ScanVideoSource | null {
    if (video.previewFile !== null) {
      const url = URL.createObjectURL(video.previewFile);
      return { url, dispose: () => URL.revokeObjectURL(url) };
    }
    if (video.url !== null) {
      return { url: video.url, dispose: () => {} };
    }
    return null;
  }
}
