import type { EditorStore } from '@core/editor/store/EditorStore';
import type { BehindActorOverride } from '@core/person-segmentation/domain/BehindActorOverride';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/** Gives a scene selection the same text-behind-actor answer in one undoable edit. */
export class SetSelectedSegmentsBehindActorOverrideAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: Telemetry,
  ) {}

  execute(args: { segmentIds: ReadonlySet<string>; override: BehindActorOverride }): void {
    const current = this.store.snapshot().behindActorOverrides;
    let next = current;
    for (const segmentId of args.segmentIds) next = next.with(segmentId, args.override);
    if (next === current) return;

    this.store.commit('selected-segments-behind-actor');
    this.store.patch({ behindActorOverrides: next });
    this.telemetry.capture('behind_actor_override_set', { override: args.override });
  }
}
