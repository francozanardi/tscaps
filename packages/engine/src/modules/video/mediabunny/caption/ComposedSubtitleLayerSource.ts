import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import { LayeredSubtitleFrame } from '@modules/rendering/LayeredSubtitleFrame';
import type {
  SubtitleLayerRequest,
  SubtitleLayerSource,
} from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import type { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';

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
 * Composes two `SubtitleLayerSource`s, routing each Section to one of
 * them by whether its style reads the video frame — by declaring it, or
 * by isolating an element over a backdrop — and merging what they paint
 * into one raster per request.
 *
 * The two halves are handed **different times for the same request**,
 * and that difference is the reason this class exists:
 *
 * - the batched half is given the request snapped to a caption tick,
 *   which is what lets the frames that resolve to one picture share a
 *   tile;
 * - the video-bound half is given the frame's own time, because it
 *   bakes the pixels under the caption into its picture, and those
 *   differ at every frame the decoder hands over.
 *
 * Snapping both would tie a whole run of frames to one backdrop
 * wherever the video runs faster than the tick rate, leaving the
 * caption sitting on pixels the video has already moved past.
 *
 * `framesFor` expects monotonically advancing times.
 */
export class ComposedSubtitleLayerSource implements SubtitleLayerSource {

  private captionInterval = 0;
  private captionIdx = 0;
  private openedBatched: SubtitleLayerSource | null = null;
  private openedVideoBound: SubtitleLayerSource | null = null;

  constructor(
    private readonly batchedSource: SubtitleLayerSource,
    private readonly videoBoundSource: SubtitleLayerSource,
    private readonly frameDemand: SubtitleStyleFrameDemand,
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
      this.openedBatched = this.batchedSource;
    }
    if (Object.keys(videoBound).length > 0) {
      await this.videoBoundSource.open(doc, videoBound, width, height, captionInterval);
      this.openedVideoBound = this.videoBoundSource;
    }
  }

  /**
   * The largest either open half asks for, so a run gathered for this
   * composite is long enough to serve the hungriest of them. The other
   * is handed the same run and is free to ignore its length.
   */
  lookAhead(): number {
    return Math.max(
      1,
      this.openedBatched?.lookAhead() ?? 1,
      this.openedVideoBound?.lookAhead() ?? 1,
    );
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    // Walked here and nowhere else: the tick index carries across
    // calls, so a request snapped twice would advance it twice.
    const onTicks = requests.map((request) => this.snapToCaptionTick(request));
    const [batchedLayers, videoBoundLayers] = await Promise.all([
      this.openedBatched?.framesFor(onTicks) ?? [],
      this.openedVideoBound?.framesFor(requests) ?? [],
    ]);
    // Batched first: the video-bound layer paints over it.
    return requests.map((_, i) =>
      LayeredSubtitleFrame.from(batchedLayers[i] ?? null, videoBoundLayers[i] ?? null),
    );
  }

  private snapToCaptionTick(request: SubtitleLayerRequest): SubtitleLayerRequest {
    this.captionIdx = this.advanceCaptionIdxToTime(this.captionIdx, request.time);
    return { time: this.captionIdx * this.captionInterval, videoFrame: request.videoFrame };
  }

  close(): void {
    this.openedBatched?.close();
    this.openedVideoBound?.close();
    this.openedBatched = null;
    this.openedVideoBound = null;
  }

  private partitionStyles(styles: Readonly<Record<string, SubtitleStyle>>): PartitionedStyles {
    const batched: Record<string, SubtitleStyle> = {};
    const videoBound: Record<string, SubtitleStyle> = {};
    for (const [kind, style] of Object.entries(styles)) {
      if (this.frameDemand.readsVideoFrame(style)) videoBound[kind] = style;
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
