import { RenderTimeMap } from '@tscaps/engine';
import { type FootageLayerFrameState } from '@tscaps/engine/advanced';
import { OUTPUT_TIME_TOLERANCE_SEC } from '@core/cuts/domain/OutputTimeTolerance';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ScheduledShot } from '@core/shots/domain/ScheduledShot';
import type { ScheduledShotLayer } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import type { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import type {
  ShotLayerCssOwnedGestureReader,
  ShotLayerGesture,
} from '@presentation/shots/services/ShotLayerCssOwnedGestureReader';
import type {
  ShotLayerHitTarget,
  ShotLayerHitTargetResolver,
} from '@presentation/shots/services/ShotLayerHitTargetResolver';

const NO_TARGETS: ReadonlyArray<ShotLayerHitTarget> = [];
const NO_GESTURES: ReadonlySet<ShotLayerGesture> = new Set();

/**
 * Keeps the overlay told which shot layers are on screen at the
 * playhead: the boxes a press can pick, for the overlay to lay its hit
 * targets on, and every layer showing, for the selection to know
 * whether a picked layer is painted. A shot's own video counts as a
 * layer showing (by its `ShotVideoLayerId`) from the shot's start to
 * the end of the shots its video runs through, so a picked shot is
 * painted while its camera is the one at the playhead. Lifecycle is
 * `start()` / `stop()`.
 *
 * Follows what the preview draws: the shots, the cuts, the video's
 * size and length, the files and whether each is ready to draw, and the
 * playhead. Where each box is comes from the layers' CSS, asked of the
 * resolver the preview draws them with (the footage store's), so a box
 * is where the layer is drawn and a moment the preview has drawn is not
 * resolved again. Each box also says which gestures its own CSS has
 * taken over, so a press does not start one that would move nothing.
 * The schedule and those gestures are worked out again on an edit only;
 * a playhead tick asks for the layers showing then, and notifies only
 * when what is on screen changed, so playback does not re-render the
 * overlay every frame.
 */
export class ShotLayerHitTargetController {
  private readonly subscribers = new Set<() => void>();
  private scheduled: ReadonlyArray<ScheduledShotLayer> = [];
  private shotVideos: ReadonlyArray<ScheduledShot> = [];
  private timeMap = new RenderTimeMap([]);
  private cssOwnedGestures: ReadonlyMap<string, ReadonlySet<ShotLayerGesture>> = new Map();
  private targets: ReadonlyArray<ShotLayerHitTarget> = NO_TARGETS;
  private visibleLayerIds: ReadonlySet<string> = new Set();
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly store: EditorStore,
    private readonly timing: ShotLayerTiming,
    private readonly resolver: ShotLayerHitTargetResolver,
    private readonly footage: ShotLayerPreviewFootageStore,
    private readonly assets: MediaAssetStore,
    private readonly preparer: MediaAssetPreparer,
    private readonly selection: OverlaySelectionController,
    private readonly cssOwnedGestureReader: ShotLayerCssOwnedGestureReader,
  ) {}

  start(): void {
    if (this.unsubscribes.length > 0) return;
    this.store.addEventListener('change', this.reschedule);
    this.store.addEventListener('timechange', this.refresh);
    this.assets.addEventListener('change', this.reschedule);
    this.footage.addEventListener('change', this.refresh);
    this.unsubscribes = [
      () => this.store.removeEventListener('change', this.reschedule),
      () => this.store.removeEventListener('timechange', this.refresh),
      () => this.assets.removeEventListener('change', this.reschedule),
      () => this.footage.removeEventListener('change', this.refresh),
      this.preparer.subscribe(this.refresh),
    ];
    this.reschedule();
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  /** The boxes a press can pick right now, bottom to top. The same array until one of them changes. */
  snapshot(): ReadonlyArray<ShotLayerHitTarget> {
    return this.targets;
  }

  private readonly reschedule = (): void => {
    const state = this.store.snapshot();
    const durationSec = state.video.duration > 0 ? state.video.duration : null;
    this.timeMap = new RenderTimeMap(state.cuts.list());
    this.scheduled = this.timing.scheduleAll(state.shots, this.assets.snapshot(), this.timeMap, durationSec);
    this.shotVideos = this.scheduleEveryShotVideo(state.shots, durationSec);
    this.cssOwnedGestures = new Map(this.scheduled.map((entry) => [
      entry.layer.id,
      this.cssOwnedGestureReader.read(state.shots.layerStyles.get(entry.layer.id)),
    ]));
    this.refresh();
  };

  private readonly refresh = (): void => {
    const state = this.store.snapshot();
    const outputTimeSec = this.timeMap.toOutputTime(state.video.currentTime);
    const states = this.statesAt(outputTimeSec);
    const onScreen = this.resolver.resolve(this.scheduled, outputTimeSec, state.frameLayout, {
      isDrawn: (mediaId) => this.preparer.statusOf(mediaId)?.phase === 'ready',
      stateOf: (layerId) => states.get(layerId) ?? null,
      placementOf: (layerId) => state.shots.placementOf(layerId),
      cssOwnedGesturesOf: (layerId) => this.cssOwnedGestures.get(layerId) ?? NO_GESTURES,
    });
    this.publishVisible(new Set([...onScreen.visibleLayerIds, ...this.shotVideoLayerIdsAt(outputTimeSec)]));
    this.publishTargets(onScreen.hitTargets);
  };

  /**
   * Every shot's own video, from its start to the start of the shot
   * after the last one its video runs through. A shot inside another's
   * run keeps its own span rather than none, so picking it still says
   * where it is. Shots cut away whole are left out.
   */
  private scheduleEveryShotVideo(shots: ShotPartition, durationSec: number | null): ReadonlyArray<ScheduledShot> {
    const list = shots.list();
    return list.flatMap((shot, index) => {
      const endSec = list[index + Math.max(1, shots.videoRunOf(shot.id).length)]?.startSec ?? durationSec ?? Infinity;
      const outputStartSec = this.timeMap.toOutputTime(shot.startSec);
      const outputEndSec = this.timeMap.toOutputTime(endSec);
      return outputEndSec - outputStartSec >= OUTPUT_TIME_TOLERANCE_SEC ? [{ shotId: shot.id, outputStartSec, outputEndSec }] : [];
    });
  }

  /** The layer ids of the shots' own videos whose stretch holds `outputTimeSec`. */
  private shotVideoLayerIdsAt(outputTimeSec: number): ReadonlyArray<string> {
    return this.shotVideos
      .filter((shot) => outputTimeSec >= shot.outputStartSec && outputTimeSec < shot.outputEndSec)
      .map((shot) => ShotVideoLayerId.of(shot.shotId));
  }

  /** How each layer the preview draws at `outputTimeSec` is drawn there, by id. */
  private statesAt(outputTimeSec: number): ReadonlyMap<string, FootageLayerFrameState> {
    const resolved = this.footage.snapshot()?.resolver.resolveAt(outputTimeSec) ?? [];
    return new Map(resolved.map(({ layer, state }) => [layer.id, state]));
  }

  private publishVisible(ids: ReadonlySet<string>): void {
    if (this.isSameSet(ids, this.visibleLayerIds)) return;
    this.visibleLayerIds = ids;
    this.selection.setPaintedShotLayerIds(ids);
  }

  private publishTargets(targets: ReadonlyArray<ShotLayerHitTarget>): void {
    if (this.isSameTargets(targets, this.targets)) return;
    this.targets = targets.length === 0 ? NO_TARGETS : targets;
    for (const callback of this.subscribers) callback();
  }

  private isSameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
    return first.size === second.size && [...first].every((id) => second.has(id));
  }

  private isSameTargets(first: ReadonlyArray<ShotLayerHitTarget>, second: ReadonlyArray<ShotLayerHitTarget>): boolean {
    return first.length === second.length && first.every((target, index) => {
      const other = second[index]!;
      return target.layerId === other.layerId
        && JSON.stringify(target.placement) === JSON.stringify(other.placement)
        && target.assetAspectRatio === other.assetAspectRatio
        && this.isSameSet(target.cssOwnedGestures, other.cssOwnedGestures)
        && target.rect.x === other.rect.x
        && target.rect.y === other.rect.y
        && target.rect.width === other.rect.width
        && target.rect.height === other.rect.height;
    });
  }
}
