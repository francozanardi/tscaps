import { VideoSample, VideoSampleSource, type Output, type Rotation, type VideoEncodingConfig } from 'mediabunny';
import type {
  PaintFrame,
  VideoTrackEncoder,
} from '@modules/video/mediabunny/encoder/VideoTrackEncoder';
import { OutputFrameCanvas } from '@modules/video/mediabunny/encoder/OutputFrameCanvas';

export interface MediaBunnyCanvasVideoTrackEncoderConfig {
  width: number;
  height: number;
  /** Keeps transparency; the canvas is cleared before every paint. Pair with `encoderConfig.alpha: 'keep'`. */
  alpha: boolean;
  /** Clockwise rotation the track declares. */
  rotation: Rotation;
  encoderConfig: VideoEncodingConfig;
}

/**
 * Owns an {@link OutputFrameCanvas} sized to the output and a
 * {@link VideoSampleSource} feeding the output's encoder. A painted frame
 * is a snapshot of the canvas; a frame encoded as decoded goes to the
 * encoder without touching the canvas.
 *
 * Hides the canvas: callers paint through the {@link PaintFrame} callback
 * passed to `encode`, never against the underlying surface directly.
 */
export class MediaBunnyCanvasVideoTrackEncoder implements VideoTrackEncoder {

  readonly width: number;
  readonly height: number;

  private readonly frameCanvas: OutputFrameCanvas;
  private readonly source: VideoSampleSource;
  private readonly rotation: Rotation;

  constructor(config: MediaBunnyCanvasVideoTrackEncoderConfig) {
    this.width = config.width;
    this.height = config.height;
    this.rotation = config.rotation;
    this.frameCanvas = new OutputFrameCanvas(config.width, config.height, config.alpha);
    this.source = new VideoSampleSource(config.encoderConfig);
  }

  attachTo(output: Output): void {
    output.addVideoTrack(this.source, { rotation: this.rotation });
  }

  async encode(timestamp: number, duration: number, paint: PaintFrame): Promise<void> {
    this.frameCanvas.paint(paint);
    const snapshot = new VideoSample(this.frameCanvas.canvas, { timestamp, duration });
    try {
      await this.source.add(snapshot);
    } finally {
      snapshot.close();
    }
  }

  async encodeAsDecoded(frame: VideoSample, timestamp: number, duration: number): Promise<void> {
    // A copy, so the frame can be retimed onto the output without touching the caller's.
    const copy = frame.clone();
    try {
      copy.setTimestamp(timestamp);
      copy.setDuration(duration);
      await this.source.add(copy);
    } finally {
      copy.close();
    }
  }
}
