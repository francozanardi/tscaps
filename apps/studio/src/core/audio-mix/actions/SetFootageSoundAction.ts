import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Sets how loud the file's own sound of every shot layer named is heard
 * while the layer shows: linear 0 to 2, clamped there; 0, the default,
 * plays it in silence. Which layers show a file with sound to give is
 * the caller's to say; the mix hears only a video's.
 *
 * One undo step; a run of changes to the same layers, such as a slider
 * drag, coalesces into one.
 */
export class SetFootageSoundAction {
  constructor(private readonly store: EditorStore) {}

  execute(layerIds: ReadonlyArray<string>, volume: number): void {
    const current = this.store.snapshot().audio;
    const next = current.withFootageSound(layerIds, volume);
    if (next === current) return;
    this.store.commit('Change b-roll sound', `footageSoundVolume:${[...layerIds].sort().join(',')}`);
    this.store.patch({ audio: next });
  }
}
