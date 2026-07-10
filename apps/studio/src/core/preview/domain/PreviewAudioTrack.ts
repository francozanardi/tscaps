import type { PreviewAudioFrame } from '@core/preview/domain/PreviewAudioFrame';

/**
 * Read access to the decoded audio frames of an opened source.
 * Source positions are in seconds against the source video's own
 * timeline.
 *
 * `streamFrames` yields frames in presentation order starting at
 * or before the requested timestamp.
 */
export interface PreviewAudioTrack {
  streamFrames(startSourceSec: number): AsyncIterable<PreviewAudioFrame>;
}
