import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Hides scenes from the video, or shows them however brief, in one
 * undoable edit. The answer outranks the brief-scene rule; a hidden scene
 * stays in the transcript, and the captions on either side close over
 * the time it occupied.
 */
export class SetSegmentsHiddenAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(args: { segmentIds: ReadonlySet<string>; hidden: boolean }): void {
    const current = this.store.snapshot().segmentVisibilityOverrides;
    let next = current;
    for (const segmentId of args.segmentIds) next = next.with(segmentId, args.hidden ? 'hidden' : 'shown');
    if (next === current) return;

    this.store.commit(args.hidden ? 'hide-segments' : 'show-segments');
    this.store.patch({ segmentVisibilityOverrides: next });
    this.reapplyEffects();
  }

  private reapplyEffects(): void {
    const snap = this.store.snapshot();
    if (!snap.document) return;
    this.store.patch({
      document: this.deriver.reapplyEffects(snap.document, snap.sheets, snap.video.duration, snap.decorationOverrides),
    });
  }
}
