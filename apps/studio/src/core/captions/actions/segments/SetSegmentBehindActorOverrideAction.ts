import type { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export class SetSegmentBehindActorOverrideAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: Telemetry,
  ) {}

  /**
   * Commits the segment's text-behind-actor override with an undo entry
   * coalesced per segment, so repeated toggles collapse into a single
   * history step. `'auto'` returns control to the detector and drops
   * the persisted entry.
   */
  execute(segmentId: string, override: BehindActorSegmentOverride): void {
    const current = this.store.snapshot().behindActorOverrides;
    const next = current.with(segmentId, override);
    if (next === current) return;
    this.store.commit(`segmentBehindActorOverride:${segmentId}`);
    this.store.patch({ behindActorOverrides: next });
    this.telemetry.capture('behind_actor_override_set', { override });
  }
}
