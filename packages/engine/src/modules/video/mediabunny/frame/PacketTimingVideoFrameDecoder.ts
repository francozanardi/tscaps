import { EncodedPacketSink, type InputVideoTrack } from 'mediabunny';
import type { TimeRange } from '@modules/video/RenderTimeMap';
import type { DecodedVideoFrame, VideoFrameDecoder } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import { TimingOnlyVideoFrame } from '@modules/video/mediabunny/frame/TimingOnlyVideoFrame';

/**
 * Yields the track's frames in presentation order without decoding any
 * of them: their times come from the packets' metadata alone. For a
 * caller that needs to know when each frame is, never what it shows.
 *
 * Drawing a frame from this decoder throws.
 */
export class PacketTimingVideoFrameDecoder implements VideoFrameDecoder {

  private timings: Promise<ReadonlyArray<FrameTiming>> | null = null;
  private closed = false;

  constructor(private readonly track: InputVideoTrack) {}

  samples(span?: TimeRange): AsyncIterable<DecodedVideoFrame> {
    return { [Symbol.asyncIterator]: () => this.iterate(span) };
  }

  canSeek(): boolean {
    return true;
  }

  close(): void {
    this.closed = true;
  }

  private async *iterate(span: TimeRange | undefined): AsyncGenerator<DecodedVideoFrame> {
    const startSec = span?.startSec ?? Number.NEGATIVE_INFINITY;
    const endSec = span?.endSec ?? Number.POSITIVE_INFINITY;
    for (const timing of await this.loadTimings()) {
      if (this.closed || timing.timestamp >= endSec) return;
      if (timing.timestamp < startSec) continue;
      yield new TimingOnlyVideoFrame(timing.timestamp, timing.duration);
    }
  }

  // Packets come in decode order; with B-frames that is not the order
  // they are shown in, so they are read once and sorted.
  private loadTimings(): Promise<ReadonlyArray<FrameTiming>> {
    this.timings ??= this.readTimings();
    return this.timings;
  }

  private async readTimings(): Promise<ReadonlyArray<FrameTiming>> {
    const timings: FrameTiming[] = [];
    for await (const packet of new EncodedPacketSink(this.track).packets(undefined, undefined, { metadataOnly: true })) {
      timings.push({ timestamp: packet.timestamp, duration: packet.duration });
    }
    return timings.sort((a, b) => a.timestamp - b.timestamp);
  }
}

interface FrameTiming {
  readonly timestamp: number;
  readonly duration: number;
}
