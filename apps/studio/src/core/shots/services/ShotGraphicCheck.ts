import { RenderTimeMap } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { GraphicCheckReport } from '@core/graphics/domain/GraphicCheckReport';
import type { GraphicCheck } from '@core/graphics/services/GraphicCheck';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { ShotGraphicMomentRecorder } from '@core/shots/domain/ShotGraphicMomentRecorder';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';
import type { ShotGraphicStageBuilder } from '@core/shots/services/ShotGraphicStageBuilder';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';

/**
 * Plays a graphic layer once, alone, as the preview and the export play
 * it: on the same stage (its box on the frame, its length, its seed, its
 * fields' values), its clock counting from when it appears. Reports what
 * it did ({@link GraphicCheck}); the moments its code declared are
 * written onto the layer, as any opening of it writes them.
 *
 * A layer no shot holds, one that is not a graphic, and one whose shot is
 * cut away entirely are reported as not opened, with the reason.
 */
export class ShotGraphicCheck {
  constructor(
    private readonly store: EditorStore,
    private readonly media: MediaAssetStore,
    private readonly timing: ShotLayerTiming,
    private readonly stages: ShotGraphicStageBuilder,
    private readonly graphics: GraphicCheck,
    private readonly moments: ShotGraphicMomentRecorder,
  ) {}

  /**
   * Checks the graphic of the layer `layerId` at `times`, seconds since
   * it appears, each clamped to how long it shows, in the box its layout
   * gives it, or `placement` would. The report's pictures are the
   * caller's to close. Rejects only with `signal`'s reason, once it
   * aborts.
   */
  async check(layerId: string, times: ReadonlyArray<number>, signal: AbortSignal, placement?: ShotLayerPlacement): Promise<GraphicCheckReport> {
    signal.throwIfAborted();
    const state = this.store.snapshot();
    const layer = state.shots.findLayer(layerId);
    if (layer === null || !('graphic' in layer)) return this.notOpened(`no shot holds a graphic layer ${layerId}`);
    const stretch = this.stretchOf(state, layerId);
    if (stretch === null) return this.notOpened('its shot is cut out of the video, so it never shows');
    const stage = this.stages.build(layer, stretch, placement ?? state.shots.placementOf(layerId), state.frameLayout);
    const report = await this.graphics.check(layer.graphic.document, stage, times, signal);
    if (report.opened) this.moments.record(layerId, layer.graphic, report.moments);
    return report;
  }

  /** Where the layer shows on the output, as the preview schedules it; null when none of it does. */
  private stretchOf(state: EditorState, layerId: string): ShotLayerStretch | null {
    const videoDurationSec = state.video.duration > 0 ? state.video.duration : null;
    const scheduled = this.timing.scheduleAll(state.shots, this.media.snapshot(), new RenderTimeMap(state.cuts.list()), videoDurationSec);
    return scheduled.find((each) => each.layer.id === layerId)?.stretch ?? null;
  }

  private notOpened(reason: string): GraphicCheckReport {
    return { opened: false, openError: reason, widthPx: 0, heightPx: 0, durationSec: 0, frames: [], messages: [], moments: [] };
  }
}
