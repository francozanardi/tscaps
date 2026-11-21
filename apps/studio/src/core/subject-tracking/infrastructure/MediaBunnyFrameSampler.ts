import { ALL_FORMATS, BlobSource, Input, VideoSampleSink, type InputVideoTrack, type VideoSample } from 'mediabunny';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SampledFrame, VideoFrameSampler } from '@core/subject-tracking/domain/VideoFrameSampler';

/** A size in pixels. */
interface FrameSize {
  readonly width: number;
  readonly height: number;
}

// Detectors read a few hundred pixels at most; a bigger frame only costs drawing and memory.
const MAX_SHORT_SIDE_PX = 480;

/**
 * Reads frames with mediabunny, decoding each stretch from the key
 * frame before it to its end, in order, and keeping the frames at the
 * stretch's rate. Reading in order decodes every frame once, where
 * seeking to each moment decodes from a key frame each time.
 */
export class MediaBunnyFrameSampler implements VideoFrameSampler {
  async *sample(video: Blob, stretches: ReadonlyArray<SamplingStretch>, signal: AbortSignal): AsyncGenerator<SampledFrame> {
    const input = new Input({ source: new BlobSource(video), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (track === null) throw new Error('The video has no video track');
      const canvas = this.canvasFor(track);
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('No 2D context to draw frames on');
      const sink = new VideoSampleSink(track);
      for (const stretch of stretches) {
        signal.throwIfAborted();
        yield* this.stretchFrames(sink, stretch, canvas, context, signal);
      }
    } finally {
      input.dispose();
    }
  }

  /** The frames of one stretch, at its rate, each closed as soon as it is drawn. */
  private async *stretchFrames(
    sink: VideoSampleSink,
    stretch: SamplingStretch,
    canvas: OffscreenCanvas,
    context: OffscreenCanvasRenderingContext2D,
    signal: AbortSignal,
  ): AsyncGenerator<SampledFrame> {
    const step = 1 / stretch.framesPerSecond;
    let wanted = stretch.startSec;
    for await (const sample of sink.samples(stretch.startSec, stretch.endSec)) {
      try {
        signal.throwIfAborted();
        const shownUntil = sample.timestamp + sample.duration;
        if (shownUntil <= wanted) continue;
        const frame = this.drawn(sample, canvas, context);
        while (wanted < shownUntil) wanted += step;
        yield frame;
      } finally {
        sample.close();
      }
    }
  }

  private drawn(sample: VideoSample, canvas: OffscreenCanvas, context: OffscreenCanvasRenderingContext2D): SampledFrame {
    sample.drawWithFit(context, { fit: 'fill' });
    return { sourceSec: sample.timestamp, bitmap: canvas.transferToImageBitmap() };
  }

  private canvasFor(track: InputVideoTrack): OffscreenCanvas {
    const size = this.sizeFor({ width: track.displayWidth, height: track.displayHeight });
    return new OffscreenCanvas(size.width, size.height);
  }

  /** `source` scaled down so its short side is at most the detectors' size; never scaled up. */
  private sizeFor(source: FrameSize): FrameSize {
    const scale = Math.min(1, MAX_SHORT_SIDE_PX / Math.min(source.width, source.height));
    return { width: Math.max(1, Math.round(source.width * scale)), height: Math.max(1, Math.round(source.height * scale)) };
  }
}
