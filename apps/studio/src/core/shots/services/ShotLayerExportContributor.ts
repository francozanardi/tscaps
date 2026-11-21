import { RenderTimeMap } from '@tscaps/engine';
import type {
  ExportRenderContext,
  ExportRenderContribution,
  ExportRenderContributor,
} from '@core/export/domain/ExportRenderContributor';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { BuiltShotLayer, ShotFootageLayerBuilder } from '@core/shots/services/ShotFootageLayerBuilder';
import type { ShotGraphicFootageBuilder } from '@core/shots/services/ShotGraphicFootageBuilder';
import type { ShotFollowStager } from '@core/shots/services/ShotFollowStager';
import type { ShotLayerStageBuilder } from '@core/shots/services/ShotLayerStageBuilder';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import type { ShotTransitionLayerBuilder } from '@core/shots/services/ShotTransitionLayerBuilder';
import type { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';

/**
 * Contributes each shot layer to the render as a footage layer drawn
 * on the video, from the file as it was added — never its proxy — with
 * the stylesheet the preview's is written as, which the engine resolves
 * frame by frame, and every transition between shots over its cut,
 * above them all. Beneath them, the video's own picture in its frame and
 * each shot's zoom (`VideoPictureFootageBuilder`), as the preview draws it,
 * and the colour grade over all of it.
 *
 * Waits for every file it needs, which on a device that has not got
 * one yet means waiting for it to come down — until the run is
 * abandoned, when it stops waiting and rejects with an `AbortError`.
 * The download itself goes on: it is the same one that brings the file
 * to this device for the next export. A file that cannot be had — its
 * bytes cannot be read, or the catalog does not hold it, so what it is
 * is not known even where bytes for it linger on the device — is left
 * out and named, so the render can say it goes without it; the shot
 * shows the video there, as the preview does. So is a GIF this browser
 * cannot play, rather than burning a still of it. A graphic needs no
 * file: it is played for the run, in its box.
 */
export class ShotLayerExportContributor implements ExportRenderContributor {
  constructor(
    private readonly repository: MediaAssetBytesRepository,
    private readonly timing: ShotLayerTiming,
    private readonly builder: ShotFootageLayerBuilder,
    private readonly videoPictures: VideoPictureFootageBuilder,
    private readonly transitions: ShotTransitionLayerBuilder,
    private readonly stages: ShotLayerStageBuilder,
    private readonly gifs: GifPlaybackProbe,
    private readonly graphics: ShotGraphicFootageBuilder,
    private readonly follows: ShotFollowStager,
  ) {}

  async prepare(context: ExportRenderContext): Promise<ExportRenderContribution> {
    const timeMap = new RenderTimeMap(context.cuts.list());
    const sources = new Map<string, Promise<Blob | null>>();
    const outputEndSec = context.videoDurationSec !== null && context.videoDurationSec > 0
      ? timeMap.toOutputTime(context.videoDurationSec)
      : null;
    const videos = this.timing.scheduleShotVideos(context.shots, timeMap, context.videoDurationSec);
    const built: BuiltShotLayer[] = this.videoPictures.build({
      frame: context.outputFrame,
      outputDurationSec: outputEndSec,
      shots: videos,
      styledVideo: context.shots.hasStyledVideo(),
    });
    const unavailable = new Set<string>();
    for (const scheduled of this.timing.scheduleAll(context.shots, context.media, timeMap, context.videoDurationSec)) {
      const { layer } = scheduled;
      if ('graphic' in layer) {
        built.push(this.graphics.build(layer, scheduled.stretch, context.shots.placementOf(layer.id), context.frameLayout));
        continue;
      }
      const mediaId = layer.mediaId;
      if (scheduled.asset === null) {
        unavailable.add(mediaId);
        continue;
      }
      const source = await this.untilAborted(this.sourceOf(mediaId, scheduled.asset, sources), context.signal);
      if (source === null) {
        unavailable.add(context.media.get(mediaId)?.fileName || mediaId);
        continue;
      }
      built.push(this.builder.build(source, scheduled));
    }
    const transitions = this.transitions.build(context.shots, timeMap, outputEndSec);
    const layers = [...built.map((layer) => layer.footage), ...transitions.map((transition) => transition.footage)];
    return {
      segmentClasses: new Map(),
      topLayer: null,
      elementsUnderTopLayer: new Set(),
      footage: layers.length === 0 && context.colorGrade.isNeutral() ? null : {
        layers,
        ...(context.colorGrade.isNeutral() ? {} : { grade: context.colorGrade.toFootageGrade() }),
        style: this.stages.build(
          built.map((layer) => layer.staged),
          context.shots.layerStyles,
          context.frameLayout,
          context.outputFrame,
          transitions.map((transition) => transition.staged),
          this.follows.stage(context.shots, videos, timeMap, context.frameLayout, context.outputFrame),
        ),
      },
      unavailableFootage: [...unavailable],
      audioMix: null,
      unavailableAudio: [],
      audioLayerFileNames: new Map(),
    };
  }

  private untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  /**
   * One read per file, however many layers use it. A read that fails, or
   * a GIF that cannot play here, leaves the file out.
   */
  private sourceOf(
    mediaId: string,
    asset: ShotLayerAsset,
    sources: Map<string, Promise<Blob | null>>,
  ): Promise<Blob | null> {
    let source = sources.get(mediaId);
    if (!source) {
      source = this.readFile(mediaId, asset);
      sources.set(mediaId, source);
    }
    return source;
  }

  private async readFile(mediaId: string, asset: ShotLayerAsset): Promise<Blob | null> {
    let file: Blob | null;
    try {
      file = await this.repository.load(mediaId, 'original');
    } catch (error) {
      console.error(`[shots] the layer file ${mediaId} could not be read for the export`, error);
      return null;
    }
    if (file === null || asset.kind !== 'gif') return file;
    try {
      await this.gifs.ensurePlayable(file);
      return file;
    } catch (error) {
      console.warn(`[shots] the GIF ${mediaId} cannot play in this browser; the export goes without it`, error);
      return null;
    }
  }
}
