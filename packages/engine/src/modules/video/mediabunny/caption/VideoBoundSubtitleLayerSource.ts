import type { Document } from '@modules/document/Document';
import type {
  SubtitleFrame,
  SubtitleFrameRenderer,
  SubtitleStyle,
} from '@modules/rendering/SubtitleFrameRenderer';
import { BufferedVideoFrameSource } from '@modules/video/mediabunny/frame/BufferedVideoFrameSource';
import type {
  SubtitleLayerRequest,
  SubtitleLayerSource,
} from '@modules/video/mediabunny/caption/SubtitleLayerSource';

/**
 * `SubtitleLayerSource` for sections whose stylesheets sample the
 * underlying video pixels — a backdrop blur, a frame-fed filter, text
 * behind the actor.
 *
 * Such a caption cannot be rendered ahead of the video the way a
 * document-driven one can: its picture is only knowable once the frame
 * beneath it exists. So the source batches the other way round, over
 * frames the caller has already gathered: it publishes the whole run
 * into a `BufferedVideoFrameSource` and asks the renderer for all of
 * their tiles in one go, so a run of frames costs one rasterization
 * instead of one each.
 *
 * The caller decides how large a run to gather, and {@link lookAhead}
 * tells it what this source can use — which is however many tiles the
 * renderer's sheet holds, since a run longer than that would spill into
 * a second rasterization and buy nothing.
 */
export class VideoBoundSubtitleLayerSource implements SubtitleLayerSource {

  private videoFrameSource: BufferedVideoFrameSource | null = null;
  private maxTilesPerBatch = 1;

  /** @param framesHaveAlpha Whether the frames are transparent, so the copies the captions sample keep their alpha. */
  constructor(
    private readonly subtitleRenderer: SubtitleFrameRenderer,
    private readonly framesHaveAlpha: boolean,
  ) {}

  async open(
    doc: Document,
    styles: Readonly<Record<string, SubtitleStyle>>,
    width: number,
    height: number,
    _captionInterval: number,
  ): Promise<void> {
    this.videoFrameSource = new BufferedVideoFrameSource(width, height, this.framesHaveAlpha);
    await this.subtitleRenderer.open(doc, styles, width, height, this.videoFrameSource);
    this.maxTilesPerBatch = await this.subtitleRenderer.getMaxTilesPerBatch();
  }

  /**
   * However many tiles the sheet holds, since a run longer than that
   * would spill into a second rasterization and buy nothing.
   *
   * It is an exact fit rather than an estimate: every timestamp served
   * here takes a tile of its own — the planner forces that for a style
   * that reads the frame — so a run of N costs exactly N tiles and one
   * of `maxTilesPerBatch` fills the sheet without ever overflowing it.
   *
   * The frames the run holds are a second buffer beside the sheet, but
   * not one this number should be shrunk for: what caps the sheet is
   * partly the raster length a host will decode without blanking its
   * far edge, and a run of separate canvases has no such edge.
   */
  lookAhead(): number {
    return this.maxTilesPerBatch;
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    if (!this.videoFrameSource || requests.length === 0) return requests.map(() => null);
    // Published before the fetch: the renderer's stylesheets pull each
    // frame back through the source while its tile rasterizes.
    this.videoFrameSource.hold(
      requests.map((request) => ({ time: request.time, frame: request.videoFrame })),
    );
    const times = requests.map((request) => request.time);
    const frames = await this.subtitleRenderer.getFrames(times);
    // A batch normally covers a prefix, but not one asked for here: a
    // run never exceeds the sheet's tile capacity and every timestamp
    // costs exactly one tile, so the whole run fits by construction.
    // Serving the tail as `null` instead would silently ship frames
    // with no caption on them.
    if (frames.length !== times.length) {
      throw new Error(
        `Subtitle renderer covered ${frames.length} of ${times.length} video-bound timestamps in one batch.`,
      );
    }
    return frames;
  }

  close(): void {
    this.subtitleRenderer.close();
    this.videoFrameSource = null;
  }
}
