import { VideoSampleSink, type InputVideoTrack, type VideoSample } from 'mediabunny';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { VideoSampleFrame } from '@modules/video/mediabunny/frame/VideoSampleFrame';

/** How far back the first look for an earlier frame reaches, in seconds; each further look reaches four times as far. */
const FIRST_LOOK_BACK_SEC = 1;

/**
 * Finds, by seeking and decoding through WebCodecs, the input frame an
 * output shows at a moment of the input's timeline: the frame on screen
 * then, by the rule a render keeps frames by — a frame is shown unless
 * its timestamp is negative or falls in a skipped range.
 *
 * A moment the output leaves out shows the first frame shown after it,
 * which is where the output picks up again; where nothing is shown after
 * it, the last frame shown before it, which is where the output ends.
 *
 * Each question seeks afresh, so moments may be asked in any order.
 */
export class ShownSourceFrameSeeker {

  private readonly sink: VideoSampleSink;

  constructor(track: InputVideoTrack, private readonly timeMap: RenderTimeMap) {
    this.sink = new VideoSampleSink(track);
  }

  /** The frame shown at `sourceSec`, which the caller closes. Rejects when the output shows no frame at all. */
  async frameShownAt(sourceSec: number): Promise<DecodedVideoFrame> {
    const asked = Math.max(0, sourceSec);
    const at = this.timeMap.findContainingRange(asked)?.endSec ?? asked;
    const onScreen = await this.sink.getSample(at);
    if (onScreen !== null && this.isShown(onScreen.timestamp)) return new VideoSampleFrame(onScreen);
    const resumeSec = onScreen === null ? at : this.resumeAfter(onScreen.timestamp);
    onScreen?.close();
    const frame = await this.firstShownFrom(resumeSec) ?? await this.lastShownBefore(asked);
    if (frame === null) throw new Error('The output shows no frame of this video.');
    return frame;
  }

  /** The render's own rule for which frames make it into the output. */
  private isShown(timestamp: number): boolean {
    return timestamp >= 0 && !this.timeMap.isSkipped(timestamp);
  }

  /** Where the frames after one left out may be shown again. */
  private resumeAfter(timestamp: number): number {
    if (timestamp < 0) return 0;
    return this.timeMap.findContainingRange(timestamp)?.endSec ?? timestamp;
  }

  private async firstShownFrom(fromSec: number): Promise<DecodedVideoFrame | null> {
    for await (const sample of this.sink.samples(fromSec)) {
      if (this.isShown(sample.timestamp)) return new VideoSampleFrame(sample);
      sample.close();
    }
    return null;
  }

  /** Looks back further each time nothing is shown in the stretch looked at, down to the input's start. */
  private async lastShownBefore(endSec: number): Promise<DecodedVideoFrame | null> {
    for (let reach = FIRST_LOOK_BACK_SEC; ; reach *= 4) {
      const startSec = Math.max(0, endSec - reach);
      const found = await this.lastShownIn(startSec, endSec);
      if (found !== null) return new VideoSampleFrame(found);
      if (startSec === 0) return null;
    }
  }

  private async lastShownIn(startSec: number, endSec: number): Promise<VideoSample | null> {
    let last: VideoSample | null = null;
    for await (const sample of this.sink.samples(startSec, endSec)) {
      if (!this.isShown(sample.timestamp)) {
        sample.close();
        continue;
      }
      last?.close();
      last = sample;
    }
    return last;
  }
}
