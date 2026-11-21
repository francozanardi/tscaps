import type { FootageCompositionRequest, FootageCompositor, FootageLayerPicture } from '@modules/video/FootageCompositor';
import type { FootageLayer } from '@modules/video/FootageLayer';
import { FootageLayerSchedule } from '@modules/video/FootageLayerSchedule';
import type { FootageStyle } from '@modules/video/FootageStyle';
import type { FootageGrade } from '@modules/video/grade/FootageGrade';
import { SourcePictureAsIs } from '@modules/video/SourcePictureAsIs';
import { SourcePicturePlacement } from '@modules/video/SourcePicturePlacement';
import type { ComposedFootageFrame, FootageFrameComposer } from '@modules/video/mediabunny/footage/FootageFrameComposer';
import type { FootageOpener } from '@modules/video/mediabunny/footage/FootageOpener';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';
import { RetainedVideoFrame } from '@modules/video/mediabunny/frame/RetainedVideoFrame';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { FootageLayerResolver } from '@modules/video/stage/FootageLayerResolver';
import type { FootageLayerResolverFactory } from '@modules/video/stage/FootageLayerResolverFactory';

/**
 * {@link FootageFrameComposer} that reads each layer's footage while the
 * output crosses its stretch: a layer is opened where its stretch begins
 * and closed where it ends, so each active video layer holds one decoder
 * of its own and an inactive one holds none.
 *
 * Each frame asks how every active layer is drawn there, resolving the
 * layers' stylesheet on a stage opened with the run and let go of when
 * it closes, and composes them in those states. A layer showing the
 * source's own picture is drawn from the source's frame and opens
 * nothing; where the layers would draw that frame as it is
 * ({@link SourcePictureAsIs}), nothing is composed.
 *
 * Where a backdrop layer is active, the frame composed up to the first
 * of them is handed out too, with the backdrops' states.
 *
 * Moments may come in any order: a layer asked for a moment earlier
 * than its last reads its footage again, from the start of its pass.
 *
 * Every frame handed out is a copy covering the output, so it outlives
 * the decoders' frames and can be held as long as the caller needs.
 * Footage that cannot be read fails the render, since its stretch would
 * otherwise show the wrong picture.
 */
export class MediaBunnyFootageFrameComposer implements FootageFrameComposer {
  private readonly schedule: FootageLayerSchedule;
  private readonly opened = new Map<FootageLayer, OpenedFootage>();
  private resolver: FootageLayerResolver | null = null;
  private width = 0;
  private height = 0;
  private sourceWidth = 0;
  private sourceHeight = 0;

  constructor(
    private readonly layers: ReadonlyArray<FootageLayer>,
    private readonly style: FootageStyle,
    private readonly resolvers: FootageLayerResolverFactory,
    private readonly opener: FootageOpener,
    private readonly compositor: FootageCompositor,
    private readonly grade: FootageGrade | undefined,
  ) {
    this.schedule = new FootageLayerSchedule(layers);
  }

  open(width: number, height: number, sourceWidth: number, sourceHeight: number): Promise<void> {
    this.width = width;
    this.height = height;
    this.sourceWidth = sourceWidth;
    this.sourceHeight = sourceHeight;
    this.resolver?.dispose();
    this.resolver = this.resolvers.open(this.layers, this.style);
    return Promise.resolve();
  }

  async frameFor(outputSec: number, sourceFrame: DecodedVideoFrame): Promise<ComposedFootageFrame> {
    const active = this.schedule.layersAt(outputSec);
    await this.closeAllBut(active);
    const pictures = await this.picturesAt(active, outputSec, sourceFrame);
    const firstBackdrop = pictures.findIndex((picture) => picture.layer.source.kind === 'backdrop');
    const beneathAll = firstBackdrop === -1 ? pictures : pictures.slice(0, firstBackdrop);
    const sourcePicture = new SourcePicturePlacement(this.requestOf(sourceFrame, beneathAll)).placed();
    if (new SourcePictureAsIs().holds(this.requestOf(sourceFrame, pictures))) {
      return { frame: null, sourcePicture, beneathBackdrops: null };
    }
    if (firstBackdrop === -1) {
      return { frame: this.composed(sourceFrame, sourceFrame, pictures), sourcePicture, beneathBackdrops: null };
    }
    const beneath = this.composed(sourceFrame, sourceFrame, beneathAll);
    const above = pictures.slice(firstBackdrop);
    return {
      frame: this.composed(sourceFrame, beneath, above, null, false),
      sourcePicture,
      beneathBackdrops: {
        frame: beneath,
        states: above.filter((picture) => picture.layer.source.kind === 'backdrop').map((picture) => picture.state),
      },
    };
  }

  /**
   * `layers` drawn over `base`, stamped as `stamp`. The base is drawn
   * whole first; with `video` the source's picture, which the
   * compositor re-frames where a layer says so, or null where the base
   * is already a composed frame. Graded where `graded` says, which a
   * base already graded is not again.
   */
  private composed(
    stamp: DecodedVideoFrame,
    base: DecodedVideoFrame,
    layers: ReadonlyArray<FootageLayerPicture>,
    video: DecodedVideoFrame | null = base,
    graded = true,
  ): DecodedVideoFrame {
    return RetainedVideoFrame.paintedBy(this.width, this.height, stamp, (context) => {
      if (video === null) base.draw(context, 0, 0, this.width, this.height);
      this.compositor.compose(context, this.requestOf(video, layers, graded));
    });
  }

  private requestOf(video: DecodedVideoFrame | null, layers: ReadonlyArray<FootageLayerPicture>, graded = true): FootageCompositionRequest {
    return {
      width: this.width,
      height: this.height,
      video,
      videoWidth: this.sourceWidth,
      videoHeight: this.sourceHeight,
      layers,
      grade: graded ? this.grade : undefined,
    };
  }

  close(): Promise<void> {
    this.resolver?.dispose();
    this.resolver = null;
    return this.closeAllBut([]);
  }

  /** The picture of each active layer at `outputSec` in its state there, bottom to top; a layer holding none is left out. */
  private async picturesAt(
    active: ReadonlyArray<FootageLayer>,
    outputSec: number,
    sourceFrame: DecodedVideoFrame,
  ): Promise<FootageLayerPicture[]> {
    if (active.length === 0) return [];
    if (this.resolver === null) throw new Error('The footage composer must be opened before it composes.');
    const pictures: FootageLayerPicture[] = [];
    for (const { layer, state } of this.resolver.resolveAt(outputSec)) {
      if (layer.source.kind === 'source-picture') {
        pictures.push({ layer, picture: sourceFrame, width: this.sourceWidth, height: this.sourceHeight, state });
        continue;
      }
      const footage = await this.openedFor(layer);
      const picture = await footage.pictureAt(this.schedule.sourceTimeAt(layer, outputSec));
      if (picture !== null) pictures.push({ layer, picture, width: footage.width, height: footage.height, state });
    }
    return pictures;
  }

  private async openedFor(layer: FootageLayer): Promise<OpenedFootage> {
    const held = this.opened.get(layer);
    if (held) return held;
    const footage = await this.opener.open(layer);
    this.opened.set(layer, footage);
    return footage;
  }

  private async closeAllBut(active: ReadonlyArray<FootageLayer>): Promise<void> {
    for (const [layer, footage] of [...this.opened]) {
      if (active.includes(layer)) continue;
      this.opened.delete(layer);
      await footage.close();
    }
  }
}
