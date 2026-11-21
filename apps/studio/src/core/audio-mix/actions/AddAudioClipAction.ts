import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Adds a clip to the project's soundtrack under a newly minted id, every
 * setting the draft leaves out taken from its role's defaults. Commits
 * the previous state so the addition is one undo step.
 */
export class AddAudioClipAction {
  constructor(
    private readonly store: EditorStore,
    private readonly defaults: AudioClipDefaults,
  ) {}

  /** The new clip's id, or null where the draft could not be added (it names no file or no anchor that can be read). */
  execute(draft: AudioClipDraft): string | null {
    const current = this.store.snapshot().audio;
    const clip = this.defaults.clipFrom(crypto.randomUUID(), draft);
    const next = current.withClipAdded(clip);
    if (next === current) return null;
    this.store.commit(draft.role === 'music' ? 'Add music' : 'Add sound');
    this.store.patch({ audio: next });
    return clip.id;
  }
}
