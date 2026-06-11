import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import { LayeredSubtitleFrame } from '@modules/rendering/LayeredSubtitleFrame';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';

// 1 µs tolerance: absorbs IEEE-754 rounding at exact interval
// boundaries (a video frame whose timestamp matches a caption
// midpoint to the last few ULPs) without affecting any real
// sub-frame difference.
const CAPTION_BOUNDARY_EPSILON_S = 1e-6;

interface PartitionedStyles {
  batched: Record<string, SubtitleStyle>;
  videoBound: Record<string, SubtitleStyle>;
}

/**
 * Composes two `SubtitleLayerSource`s, routing each Section to one
 * of them by whether its style declares
 * `rendering.videoFrame.required`. Snaps the time of each
 * `frameAt` call to the nearest caption tick and merges the rasters
 * produced by sub-sources with active sections into a single frame.
 *
 * `frameAt` expects monotonically advancing times.
 */
export class ComposedSubtitleLayerSource implements SubtitleLayerSource {

  private captionInterval = 0;
  private captionIdx = 0;
  private readonly openedSources: SubtitleLayerSource[] = [];

  constructor(
    private readonly batchedSource: SubtitleLayerSource,
    private readonly videoBoundSource: SubtitleLayerSource,
  ) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    captionInterval: number,
  ): Promise<void> {
    this.captionInterval = captionInterval;
    this.captionIdx = 0;
    const { batched, videoBound } = this.partitionStyles(styles);
    if (Object.keys(batched).length > 0) {
      await this.batchedSource.open(doc, batched, width, height, captionInterval);
      this.openedSources.push(this.batchedSource);
    }
    if (Object.keys(videoBound).length > 0) {
      await this.videoBoundSource.open(doc, videoBound, width, height, captionInterval);
      this.openedSources.push(this.videoBoundSource);
    }
  }

  async frameAt(time: number, videoFrame: DecodedVideoFrame): Promise<SubtitleFrame | null> {
    this.captionIdx = this.advanceCaptionIdxToTime(this.captionIdx, time);
    const captionTime = this.captionIdx * this.captionInterval;
    const layers = await Promise.all(
      this.openedSources.map((source) => source.frameAt(captionTime, videoFrame)),
    );
    return LayeredSubtitleFrame.from(...layers);
  }

  close(): void {
    for (const source of this.openedSources) source.close();
    this.openedSources.length = 0;
  }

  private partitionStyles(styles: Readonly<Record<string, SubtitleStyle>>): PartitionedStyles {
    const batched: Record<string, SubtitleStyle> = {};
    const videoBound: Record<string, SubtitleStyle> = {};
    for (const [kind, style] of Object.entries(styles)) {
      if (style.rendering.videoFrame.required) videoBound[kind] = style;
      else batched[kind] = style;
    }
    return { batched, videoBound };
  }

  // Caption N covers `[(N-0.5)·interval, (N+0.5)·interval)`. This
  // halves the worst-case timing error vs. floor-only mapping at
  // the cost of letting a caption appear up to `interval/2` early.
  private advanceCaptionIdxToTime(currentIdx: number, time: number): number {
    let idx = currentIdx;
    while ((idx + 0.5) * this.captionInterval <= time + CAPTION_BOUNDARY_EPSILON_S) {
      idx++;
    }
    return idx;
  }
}
