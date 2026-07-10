import type {
  CodecPolicy,
  VideoCodecResolution,
  VideoCodecResolutionRequest,
} from '@tscaps/engine';

/**
 * Fixed codec policy for the preview proxy pipeline: always H.264 at a
 * low bitrate with 1s key frames and realtime latency. Ignores the
 * caller's quality preset and the container's advertised supported
 * codecs — the proxy pipeline pins the output to MP4/AVC end-to-end
 * so the editor's preview decoder runs cheap on every input.
 *
 * Short key-frame interval trades file size for random-access
 * granularity, which matters far more than compression for a proxy
 * that will be scrubbed constantly during editing.
 */
export class FixedPreviewProxyCodecPolicy implements CodecPolicy {

  private static readonly TARGET_BITRATE_BPS = 800_000;
  private static readonly KEY_FRAME_INTERVAL_SEC = 1;

  async resolveVideo(_request: VideoCodecResolutionRequest): Promise<VideoCodecResolution> {
    return {
      codec: 'avc',
      bitrate: FixedPreviewProxyCodecPolicy.TARGET_BITRATE_BPS,
      bitrateMode: 'variable',
      latencyMode: 'realtime',
      keyFrameInterval: FixedPreviewProxyCodecPolicy.KEY_FRAME_INTERVAL_SEC,
    };
  }
}
