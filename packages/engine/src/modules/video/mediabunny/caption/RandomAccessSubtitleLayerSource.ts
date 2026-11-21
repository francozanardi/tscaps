import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import { LayeredSubtitleFrame } from '@modules/rendering/LayeredSubtitleFrame';
import type { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';
import type {
  SubtitleLayerRequest,
  SubtitleLayerSource,
} from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import { CaptionTicks } from '@modules/video/mediabunny/caption/CaptionTicks';

interface PartitionedStyles {
  readonly documentDriven: Record<string, SubtitleStyle>;
  readonly videoBound: Record<string, SubtitleStyle>;
}

/**
 * `SubtitleLayerSource` that answers any time in any order, for a
 * caller that paints moments out of sequence rather than a run from
 * start to end.
 *
 * Each Section is routed by whether its style reads the video frame,
 * as `ComposedSubtitleLayerSource` routes it, and the two halves are
 * merged the same way, the video-bound one painted over the other:
 *
 * - a style that does not read the frame is rendered for the caption
 *   tick the request lands on, by the same rule a render in order
 *   follows ({@link CaptionTicks}), asking the renderer for exactly
 *   the ticks requested and nothing ahead of them;
 * - a style that reads the frame goes to the video-bound source, handed
 *   the frame's own time, which never depended on what came before.
 *
 * Nothing carries from one call to the next but the open renderers, so
 * a time earlier than the last one asked is painted as if it were the
 * first.
 */
export class RandomAccessSubtitleLayerSource implements SubtitleLayerSource {

  private ticks: CaptionTicks | null = null;
  private openedDocumentDriven: SubtitleFrameRenderer | null = null;
  private openedVideoBound: SubtitleLayerSource | null = null;

  constructor(
    private readonly documentDrivenRenderer: SubtitleFrameRenderer,
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
    this.ticks = new CaptionTicks(captionInterval);
    const { documentDriven, videoBound } = this.partitionStyles(styles);
    if (Object.keys(documentDriven).length > 0) {
      await this.documentDrivenRenderer.open(doc, documentDriven, width, height);
      this.openedDocumentDriven = this.documentDrivenRenderer;
    }
    if (Object.keys(videoBound).length > 0) {
      await this.videoBoundSource.open(doc, videoBound, width, height, captionInterval);
      this.openedVideoBound = this.videoBoundSource;
    }
  }

  /**
   * What the video-bound half asks for, since a run of frames it bakes
   * in one sheet is the only saving on offer; the other half renders the
   * ticks it is asked and gains nothing from a longer run.
   */
  lookAhead(): number {
    return Math.max(1, this.openedVideoBound?.lookAhead() ?? 1);
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    const [documentDrivenLayers, videoBoundLayers] = await Promise.all([
      this.documentDrivenFramesFor(requests),
      this.openedVideoBound?.framesFor(requests) ?? [],
    ]);
    // Document-driven first: the video-bound layer paints over it.
    return requests.map((_, i) =>
      LayeredSubtitleFrame.from(documentDrivenLayers[i] ?? null, videoBoundLayers[i] ?? null),
    );
  }

  close(): void {
    this.openedDocumentDriven?.close();
    this.openedVideoBound?.close();
    this.openedDocumentDriven = null;
    this.openedVideoBound = null;
    this.ticks = null;
  }

  /**
   * One raster per request, each for the tick its time lands on. A
   * renderer answers a prefix of what it is offered, so the ticks are
   * offered again from wherever the last answer stopped.
   */
  private async documentDrivenFramesFor(
    requests: ReadonlyArray<SubtitleLayerRequest>,
  ): Promise<Array<SubtitleFrame | null>> {
    const renderer = this.openedDocumentDriven;
    const ticks = this.ticks;
    if (renderer === null || ticks === null) return requests.map(() => null);
    const onTicks = requests.map((request) => ticks.timeOf(ticks.indexAt(request.time)));
    const frames: Array<SubtitleFrame | null> = [];
    while (frames.length < onTicks.length) {
      const answered = await renderer.getFrames(onTicks.slice(frames.length));
      if (answered.length === 0) {
        // Nothing to advance by: asking again would never end.
        throw new Error('Subtitle renderer returned no frames for a non-empty batch.');
      }
      frames.push(...answered);
    }
    return frames;
  }

  private partitionStyles(styles: Readonly<Record<string, SubtitleStyle>>): PartitionedStyles {
    const documentDriven: Record<string, SubtitleStyle> = {};
    const videoBound: Record<string, SubtitleStyle> = {};
    for (const [kind, style] of Object.entries(styles)) {
      if (this.frameDemand.readsVideoFrame(style)) videoBound[kind] = style;
      else documentDriven[kind] = style;
    }
    return { documentDriven, videoBound };
  }
}
