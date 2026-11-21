import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

/**
 * Puts one caption element back to what its template gives it: forgets
 * what its fields were left at, the motion it was given, the CSS beside
 * them, where it was dropped in the frame, whether it goes behind the
 * person, and the sounds placed on it. One undo step; nothing happens
 * where the element already holds nothing of its own.
 *
 * Its own action rather than a write of empty CSS. Those are different
 * things: text arriving empty means the user emptied the editor and
 * says nothing about the fields, which keep their values so that
 * editing the text by hand does not quietly forget what was picked.
 * Wiping the element has to forget all of it, and doing it by writing
 * an empty document would leave every field recorded against a
 * declaration that is no longer there — each of them reporting, on the
 * next render, that the CSS had taken it over.
 */
export class ResetCaptionElementAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(elementId: string): void {
    const snap = this.store.snapshot();
    const elementStyles = snap.elementStyles.without([elementId]);
    const behindActorOverrides = snap.behindActorOverrides.without([elementId]);
    const audio = snap.audio.withoutClips(this.soundIdsOn(elementId));
    if (elementStyles === snap.elementStyles && behindActorOverrides === snap.behindActorOverrides && audio === snap.audio) return;

    this.store.commit('Reset element', `elementStyle:${elementId}:cleared`);
    this.store.patch({ elementStyles, behindActorOverrides, audio });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }

  /** Whether the element holds anything a reset would take back. */
  holdsAnything(elementId: string): boolean {
    const snap = this.store.snapshot();
    return snap.elementStyles.has(elementId)
      || snap.behindActorOverrides.all().has(elementId)
      || this.soundIdsOn(elementId).length > 0;
  }

  // A sound placed on a word plays at its start or its end; no other caption element holds sounds.
  private soundIdsOn(elementId: string): string[] {
    return this.store.snapshot().audio.clips()
      .filter(({ start: { anchor } }) => anchor.kind === 'word' && anchor.wordId === elementId)
      .map((clip) => clip.id);
  }
}
