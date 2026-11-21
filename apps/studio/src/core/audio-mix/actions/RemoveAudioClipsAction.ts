import type { EditorStore } from '@core/editor/store/EditorStore';
import type { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';

/**
 * Takes clips off the project's soundtrack. The files they play stay in
 * the project. Commits the previous state so the whole removal is one
 * undo step; clips that are already gone are skipped.
 */
export class RemoveAudioClipsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: AudioMixTelemetryReporter,
  ) {}

  execute(clipIds: Iterable<string>): void {
    const before = this.store.snapshot();
    const next = before.audio.withoutClips(clipIds);
    if (next === before.audio) return;
    this.store.commit('Remove sound');
    this.store.patch({ audio: next });
    this.telemetry.clipsRemoved(before, before.audio.clips().filter((clip) => next.clip(clip.id) === null));
  }
}
