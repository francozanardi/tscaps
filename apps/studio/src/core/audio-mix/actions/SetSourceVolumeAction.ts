import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Sets the level of the video's own sound in the mix, linear 0 to 2 and
 * clamped there; 0 silences it. One undo step, a slider drag coalescing
 * into one.
 */
export class SetSourceVolumeAction {
  constructor(private readonly store: EditorStore) {}

  execute(volume: number): void {
    const current = this.store.snapshot().audio;
    const next = current.withSourceVolume(volume);
    if (next === current) return;
    this.store.commit('Change video volume', 'audioSourceVolume');
    this.store.patch({ audio: next });
  }
}
