import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';

/**
 * `SubtitleLayerSource` that renders ahead in chunks sized to the
 * underlying renderer's preferred batch size, amortizing the fixed
 * cost of a batch fetch across many video frames. The decoded video
 * frame passed to `frameAt` is ignored.
 *
 * Picks the right strategy for sections whose stylesheets are
 * independent of the underlying video pixels.
 *
 * Times handed to `frameAt` are expected to land on a caption tick
 * (a multiple of the `captionInterval` supplied at `open`); the
 * source rounds to absorb the FP roundtrip but does not snap from
 * arbitrary timestamps.
 */
export class BatchedSubtitleLayerSource implements SubtitleLayerSource {

  private captionInterval = 0;
  private batchSize = 0;
  private currentChunkFirstIdx = 0;
  private currentChunkFrames: ReadonlyArray<SubtitleFrame | null> = [];
  private opened = false;

  constructor(private readonly subtitleRenderer: SubtitleFrameRenderer) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    captionInterval: number,
  ): Promise<void> {
    await this.subtitleRenderer.open(doc, styles, width, height);
    this.captionInterval = captionInterval;
    this.batchSize = await this.subtitleRenderer.getMaxBatchSize();
    // Sentinel: the first `frameAt` call's while-condition fires one
    // `loadNextChunk` that lands the resident window at index 0.
    this.currentChunkFirstIdx = -this.batchSize;
    this.currentChunkFrames = [];
    this.opened = true;
  }

  async frameAt(time: number, _videoFrame: DecodedVideoFrame): Promise<SubtitleFrame | null> {
    if (!this.opened) return null;
    const captionIdx = Math.round(time / this.captionInterval);
    while (captionIdx >= this.currentChunkFirstIdx + this.batchSize) {
      await this.loadNextChunk();
    }
    return this.currentChunkFrames[captionIdx - this.currentChunkFirstIdx] ?? null;
  }

  close(): void {
    this.subtitleRenderer.close();
    this.currentChunkFrames = [];
    this.opened = false;
  }

  private async loadNextChunk(): Promise<void> {
    this.currentChunkFirstIdx += this.batchSize;
    const timestamps: number[] = [];
    for (let i = 0; i < this.batchSize; i++) {
      // Each timestamp is freshly computed from its absolute index
      // to avoid floating-point accumulation drift across long videos.
      timestamps.push((this.currentChunkFirstIdx + i) * this.captionInterval);
    }
    this.currentChunkFrames = await this.subtitleRenderer.getFrames(timestamps);
  }
}
