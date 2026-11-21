import { RenderTimeMap } from '@tscaps/engine';
import { type FootageLayerResolverFactory } from '@tscaps/engine/advanced';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetProxyCache } from '@core/media/services/MediaAssetProxyCache';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { ScheduledShot } from '@core/shots/domain/ScheduledShot';
import type { BuiltShotLayer, ShotFootageLayerBuilder } from '@core/shots/services/ShotFootageLayerBuilder';
import type { ShotFollowStager } from '@core/shots/services/ShotFollowStager';
import type { ShotGraphicFootageBuilder } from '@core/shots/services/ShotGraphicFootageBuilder';
import type { ShotLayerStageBuilder } from '@core/shots/services/ShotLayerStageBuilder';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import type { ShotTransitionLayerBuilder } from '@core/shots/services/ShotTransitionLayerBuilder';
import type { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';
import type { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';

/**
 * Keeps the preview showing every shot layer, from its proxy, when and
 * where the export burns it, and looking and moving as its CSS says,
 * over the video's own picture, in its frame and each shot's zoom
 * (`VideoPictureFootageBuilder`), following whoever a shot follows,
 * and every transition between shots over its cut, above them all:
 * each change of the layers, their styles or the frame writes their
 * stylesheet again and opens a resolver on it, which the preview asks
 * every frame it draws. The layers and that resolver go to the surface
 * and to the footage store, for anything else showing a layer where the
 * preview does to ask the same resolver; the one they replace is let go.
 *
 * A layer whose file is not ready yet is left out, so the video shows
 * there until it is; it appears on its own once its proxy is at hand.
 * So is a layer whose file the catalog does not hold, whatever bytes
 * for it are still around: what it is cannot be known. A graphic needs
 * no file and shows as soon as it has drawn its first picture.
 */
export class ShotLayerPreviewAutomation {
  private lastState: EditorState | null = null;
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly store: EditorStore,
    private readonly surface: VideoPreviewSurface,
    private readonly timing: ShotLayerTiming,
    private readonly builder: ShotFootageLayerBuilder,
    private readonly videoPictures: VideoPictureFootageBuilder,
    private readonly transitions: ShotTransitionLayerBuilder,
    private readonly stages: ShotLayerStageBuilder,
    private readonly resolvers: FootageLayerResolverFactory,
    private readonly footage: ShotLayerPreviewFootageStore,
    private readonly assets: MediaAssetStore,
    private readonly preparer: MediaAssetPreparer,
    private readonly proxies: MediaAssetProxyCache,
    private readonly graphics: ShotGraphicFootageBuilder,
    private readonly follows: ShotFollowStager,
  ) {}

  start(): void {
    this.store.addEventListener('change', this.onStoreChange);
    this.assets.addEventListener('change', this.refresh);
    this.unsubscribes = [this.preparer.subscribe(this.refresh), this.proxies.subscribe(this.refresh)];
    this.refresh();
  }

  stop(): void {
    this.store.removeEventListener('change', this.onStoreChange);
    this.assets.removeEventListener('change', this.refresh);
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
    this.lastState = null;
    this.replaceFootage(null);
  }

  private readonly onStoreChange = (): void => {
    if (this.lastState && !this.layerInputsChanged(this.lastState, this.store.snapshot())) return;
    this.refresh();
  };

  private readonly refresh = (): void => {
    const state = this.store.snapshot();
    this.lastState = state;
    const timeMap = new RenderTimeMap(state.cuts.list());
    const outputEndSec = this.outputEndOf(state, timeMap);
    const videos = this.timing.scheduleShotVideos(state.shots, timeMap, state.video.duration > 0 ? state.video.duration : null);
    const built = [...this.videoPicturesFor(state, videos, outputEndSec), ...this.layersFor(state, timeMap)];
    const transitions = this.transitions.build(state.shots, timeMap, outputEndSec);
    const layers = [...built.map((layer) => layer.footage), ...transitions.map((transition) => transition.footage)];
    const style = this.stages.build(
      built.map((layer) => layer.staged),
      state.shots.layerStyles,
      state.frameLayout,
      state.outputFrame,
      transitions.map((transition) => transition.staged),
      this.follows.stage(state.shots, videos, timeMap, state.frameLayout, state.outputFrame),
    );
    const footage = {
      layers,
      resolver: this.resolvers.open(layers, style),
      frame: state.frameLayout,
      outputEndSec,
      grade: state.colorGrade.isNeutral() ? null : state.colorGrade.toFootageGrade(),
    };
    this.surface.setFootage(footage);
    this.replaceFootage(footage);
  };

  /** Publishes `footage` and lets go of the resolver it replaces, which nothing asks once it is replaced. */
  private replaceFootage(footage: PreviewFootage | null): void {
    const replaced = this.footage.snapshot();
    this.footage.set(footage);
    replaced?.resolver.dispose();
  }

  private outputEndOf(state: EditorState, timeMap: RenderTimeMap): number | null {
    return state.video.duration > 0 ? timeMap.toOutputTime(state.video.duration) : null;
  }

  private videoPicturesFor(state: EditorState, videos: ReadonlyArray<ScheduledShot>, outputEndSec: number | null): BuiltShotLayer[] {
    return this.videoPictures.build({
      frame: state.outputFrame,
      outputDurationSec: outputEndSec,
      shots: videos,
      styledVideo: state.shots.hasStyledVideo(),
    });
  }

  private layersFor(state: EditorState, timeMap: RenderTimeMap): BuiltShotLayer[] {
    const durationSec = state.video.duration > 0 ? state.video.duration : null;
    const layers: BuiltShotLayer[] = [];
    for (const scheduled of this.timing.scheduleAll(state.shots, this.assets.snapshot(), timeMap, durationSec)) {
      const { layer } = scheduled;
      if ('graphic' in layer) {
        layers.push(this.graphics.build(layer, scheduled.stretch, state.shots.placementOf(layer.id), state.frameLayout));
        continue;
      }
      const mediaId = layer.mediaId;
      if (scheduled.asset === null || this.preparer.statusOf(mediaId)?.phase !== 'ready') {
        this.proxies.forget(mediaId);
        continue;
      }
      const source = this.proxies.proxyOf(state.projectId, mediaId);
      if (source) layers.push(this.builder.build(source, scheduled));
    }
    return layers;
  }

  private layerInputsChanged(previous: EditorState, next: EditorState): boolean {
    return previous.shots !== next.shots
      || previous.cuts !== next.cuts
      || previous.video.duration !== next.video.duration
      || previous.frameLayout !== next.frameLayout
      || previous.outputFrame !== next.outputFrame
      || previous.colorGrade !== next.colorGrade
      || previous.projectId !== next.projectId;
  }
}
