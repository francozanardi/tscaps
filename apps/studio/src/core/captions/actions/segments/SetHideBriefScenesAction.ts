import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Turns hiding scenes too brief to read on or off for the caption track
 * being edited, in one undoable edit. Scenes the user hid or showed by
 * hand keep their answer either way.
 */
export class SetHideBriefScenesAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(enabled: boolean): void {
    if (this.store.snapshot().hideBriefScenes === enabled) return;

    this.store.commit(`hide-brief-scenes:${enabled}`);
    this.store.patch({ hideBriefScenes: enabled });
    const snap = this.store.snapshot();
    if (!snap.document) return;
    this.store.patch({
      document: this.deriver.reapplyEffects(snap.document, snap.sheets, snap.video.duration, snap.decorationOverrides),
    });
  }
}
