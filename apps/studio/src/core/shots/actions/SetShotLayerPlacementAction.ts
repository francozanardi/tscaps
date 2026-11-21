import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import type { ShotLayerLayoutChangeReader } from '@core/shots/services/ShotLayerLayoutChangeReader';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayoutFollower } from '@core/shots/domain/ShotLayoutFollower';
import type { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import type { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';

/**
 * Lays one layer out anew, writing the layout as its fields; no other
 * layer moves. The layout is remembered as the last its role was edited
 * to, so the next layer of that role starts there; what a new layout
 * brings along (its transitions' sounds) lands with it. Commits the previous
 * state so the operation participates in undo/redo; a run of changes to
 * one layer's layout, such as a drag, is one undo step.
 */
export class SetShotLayerPlacementAction {
  constructor(
    private readonly store: EditorStore,
    private readonly layouts: ShotLayerLayoutWriter,
    private readonly lastEditedPlacements: LastEditedPlacementRecorder,
    private readonly follower: ShotLayoutFollower,
    private readonly layoutChanges: ShotLayerLayoutChangeReader,
    private readonly telemetry: ShotEditTelemetryReporter,
  ) {}

  execute(layerId: string, placement: ShotLayerPlacement): void {
    const state = this.store.snapshot();
    const placed = this.layouts.withLayout(state.shots, layerId, placement);
    if (placed === state.shots) return;
    this.store.commit('Change layout', `shotLayerPlacement:${layerId}`);
    this.store.patch(this.follower.patchFor(state, this.lastEditedPlacements.record(placed, [layerId])));
    for (const change of this.layoutChanges.between(state.shots.placementOf(layerId), placed.placementOf(layerId))) {
      this.telemetry.layoutSet(change.field, change.value, 1);
    }
  }
}
