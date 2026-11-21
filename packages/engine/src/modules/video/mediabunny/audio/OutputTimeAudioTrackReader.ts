import type { AudioSample } from 'mediabunny';
import { AudioChannelMap } from '@modules/video/mediabunny/audio/AudioChannelMap';
import type { AudioGainEnvelope } from '@modules/video/AudioGainEnvelope';
import type { RenderTimeMap } from '@modules/video/RenderTimeMap';

/** Frames of the track that land one after another in the output. */
interface OutputRun {
  readonly startFrame: number;
  readonly channels: ReadonlyArray<Float32Array>;
}

/** The rate and channel count the track decodes to. */
export interface DecodedAudioShape {
  readonly sampleRate: number;
  readonly numberOfChannels: number;
}

/**
 * Reads an input's decoded audio in output time: the skipped windows are
 * cut out to the sample, every cut edge is faded over 5 ms on both
 * sides so the join does not click, and the level is shaped by a gain
 * envelope over output time.
 *
 * Frames are numbered in output time at the track's own decoded rate,
 * frame `n` at `n / sampleRate` seconds; frames before the source's 0
 * are left out. {@link open} once, then {@link addInto} over windows
 * that only ever move forward, then {@link close}.
 *
 * The samples are taken as they come, in source-time order and without
 * overlap; whatever decodes them decides the rate. A decoding failure
 * rejects the call that reached it, with the decoder's own error.
 */
export class OutputTimeAudioTrackReader {

  private static readonly CUT_EDGE_FADE_SEC = 0.005;
  /** Slack for frame positions computed from times that should be whole. */
  private static readonly FRAME_EPSILON = 1e-6;

  private readonly iterator: AsyncIterator<AudioSample>;
  private pending: AudioSample | null = null;
  private runs: OutputRun[] = [];
  private exhausted = false;
  private readThroughFrame = Number.NEGATIVE_INFINITY;
  private shape: DecodedAudioShape | null = null;
  private channelMap: AudioChannelMap | null = null;

  constructor(
    samples: AsyncIterable<AudioSample>,
    private readonly timeMap: RenderTimeMap,
    private readonly gain: AudioGainEnvelope,
    private readonly maxChannels: number,
  ) {
    this.iterator = samples[Symbol.asyncIterator]();
  }

  /**
   * Decodes the first stretch of the track and answers the shape the
   * reader writes: the decoded rate, which can differ from the one the
   * container declares, and the channels capped at `maxChannels`.
   */
  async open(): Promise<DecodedAudioShape> {
    this.pending = await this.next();
    const sampleRate = this.pending?.sampleRate ?? 48_000;
    const sourceChannels = this.pending?.numberOfChannels ?? 1;
    const numberOfChannels = Math.min(sourceChannels, this.maxChannels);
    this.shape = { sampleRate, numberOfChannels };
    this.channelMap = new AudioChannelMap(sourceChannels, numberOfChannels);
    return this.shape;
  }

  /**
   * Adds the track's frames `[startFrame, startFrame + target[0].length)`
   * into `target`, one array per channel. A window must not start before
   * the end of the previous one.
   */
  async addInto(target: ReadonlyArray<Float32Array>, startFrame: number): Promise<void> {
    const endFrame = startFrame + (target[0]?.length ?? 0);
    await this.readThrough(endFrame);
    for (const run of this.runs) this.addOverlap(run, target, startFrame, endFrame);
    this.runs = this.runs.filter((run) => run.startFrame + (run.channels[0]?.length ?? 0) > endFrame);
  }

  /** Stops decoding. Idempotent. */
  async close(): Promise<void> {
    this.pending?.close();
    this.pending = null;
    this.runs = [];
    if (!this.exhausted) {
      this.exhausted = true;
      await this.iterator.return?.();
    }
  }

  /**
   * Decodes until every frame before `endFrame` is known. A frame just
   * after a cut can round onto the last frame before it, hence one frame
   * of reach past the end.
   */
  private async readThrough(endFrame: number): Promise<void> {
    while (!this.exhausted && this.readThroughFrame <= endFrame + 1) {
      const sample = this.pending ?? await this.next();
      this.pending = null;
      if (!sample) {
        this.exhausted = true;
        return;
      }
      try {
        this.runs.push(...this.runsOf(sample));
        const sampleEndSec = sample.timestamp + sample.numberOfFrames / sample.sampleRate;
        this.readThroughFrame = this.outputFrameOf(sampleEndSec);
      } finally {
        sample.close();
      }
    }
  }

  private async next(): Promise<AudioSample | null> {
    const { value, done } = await this.iterator.next();
    return done || !value ? null : value;
  }

  /** The stretches of `sample` that are kept, each placed in output time. */
  private runsOf(sample: AudioSample): OutputRun[] {
    const planes = this.planesOf(sample);
    const runs: OutputRun[] = [];
    let frame = 0;
    while (frame < sample.numberOfFrames) {
      const timeSec = this.timeOf(sample, frame);
      if (timeSec < 0) {
        frame = Math.max(frame + 1, this.firstFrameFrom(sample, 0));
        continue;
      }
      const cut = this.timeMap.findContainingRange(timeSec);
      if (cut) {
        frame = Math.max(frame + 1, this.firstFrameFrom(sample, cut.endSec));
        continue;
      }
      const nextCut = this.timeMap.findFirstRangeStartingAfter(timeSec);
      const runEnd = nextCut
        ? Math.min(sample.numberOfFrames, Math.max(frame + 1, this.firstFrameFrom(sample, nextCut.startSec)))
        : sample.numberOfFrames;
      runs.push(this.runOf(sample, planes, frame, runEnd));
      frame = runEnd;
    }
    return runs;
  }

  private runOf(sample: AudioSample, planes: ReadonlyArray<Float32Array>, from: number, to: number): OutputRun {
    const startSec = this.timeOf(sample, from);
    const previousCut = this.timeMap.findLastRangeEndingBy(startSec);
    const nextCut = this.timeMap.findFirstRangeStartingAfter(startSec);
    const channelMap = this.channelMap!;
    const startFrame = this.outputFrameOf(startSec);
    const gains = new Float32Array(to - from);
    this.gain.sampleInto(gains, startFrame, this.shape!.sampleRate);
    const channels: Float32Array[] = [];
    for (let channel = 0; channel < channelMap.targetChannels; channel++) {
      const out = new Float32Array(to - from);
      const weight = channelMap.weightOf(channel);
      for (const source of channelMap.sourcesOf(channel)) {
        const plane = planes[source]!;
        for (let index = 0; index < out.length; index++) out[index]! += plane[from + index]! * weight * gains[index]!;
      }
      channels.push(out);
    }
    this.fadeCutEdges(channels, sample, from, previousCut?.endSec ?? null, nextCut?.startSec ?? null);
    return { startFrame, channels };
  }

  /** Ramps the run up from a cut that ends before it and down into one that starts after it. */
  private fadeCutEdges(
    channels: ReadonlyArray<Float32Array>,
    sample: AudioSample,
    from: number,
    previousCutEndSec: number | null,
    nextCutStartSec: number | null,
  ): void {
    const fadeSec = OutputTimeAudioTrackReader.CUT_EDGE_FADE_SEC;
    const length = channels[0]?.length ?? 0;
    for (let index = 0; index < length; index++) {
      const timeSec = this.timeOf(sample, from + index);
      let level = 1;
      if (previousCutEndSec !== null) level = Math.min(level, (timeSec - previousCutEndSec) / fadeSec);
      if (nextCutStartSec !== null) level = Math.min(level, (nextCutStartSec - timeSec) / fadeSec);
      if (level >= 1) continue;
      for (const channel of channels) channel[index]! *= Math.max(0, level);
    }
  }

  private planesOf(sample: AudioSample): Float32Array[] {
    const planes: Float32Array[] = [];
    for (let planeIndex = 0; planeIndex < sample.numberOfChannels; planeIndex++) {
      const plane = new Float32Array(sample.numberOfFrames);
      sample.copyTo(plane, { planeIndex, format: 'f32-planar' });
      planes.push(plane);
    }
    return planes;
  }

  private addOverlap(run: OutputRun, target: ReadonlyArray<Float32Array>, startFrame: number, endFrame: number): void {
    const runLength = run.channels[0]?.length ?? 0;
    const from = Math.max(startFrame, run.startFrame);
    const to = Math.min(endFrame, run.startFrame + runLength);
    for (let frame = from; frame < to; frame++) {
      for (const [channel, data] of run.channels.entries()) {
        target[channel]![frame - startFrame]! += data[frame - run.startFrame]!;
      }
    }
  }

  private timeOf(sample: AudioSample, frame: number): number {
    return sample.timestamp + frame / sample.sampleRate;
  }

  /** The first frame of `sample` at or after `timeSec`. */
  private firstFrameFrom(sample: AudioSample, timeSec: number): number {
    const exact = (timeSec - sample.timestamp) * sample.sampleRate;
    return Math.ceil(exact - OutputTimeAudioTrackReader.FRAME_EPSILON);
  }

  private outputFrameOf(sourceSec: number): number {
    return Math.round(this.timeMap.toOutputTime(sourceSec) * this.shape!.sampleRate);
  }
}
