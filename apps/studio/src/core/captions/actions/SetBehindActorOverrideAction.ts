import type { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export class SetBehindActorOverrideAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: Telemetry,
  ) {}

  /**
   * Commits the element's text-behind-actor override — a scene's, or a
   * word's — with an undo entry coalesced per element, so repeated
   * toggles collapse into a single history step. `'auto'` returns
   * control to the detector and drops the persisted entry.
   */
  execute(elementId: string, override: BehindActorOverride): void {
    const current = this.store.snapshot().behindActorOverrides;
    const next = current.with(elementId, override);
    if (next === current) return;
    this.store.commit(`behindActorOverride:${elementId}`);
    this.store.patch({ behindActorOverrides: next });
    this.telemetry.capture('behind_actor_override_set', { override });
  }
}
