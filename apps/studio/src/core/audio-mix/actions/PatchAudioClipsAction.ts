import type { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioClipPatch } from '@core/audio-mix/domain/AudioClipPatch';
import type { EditorStore } from '@core/editor/store/EditorStore';

/**
 * Writes one patch into one clip or several: only the fields the patch
 * names change on each, so the clips keep whatever else differs between
 * them, and every value is clamped to its range. Clips that are gone are
 * skipped; nothing happens where no clip would change.
 *
 * One action, one undo step: a run of changes to the same fields of the
 * same clips, such as a slider drag, coalesces into one.
 */
export class PatchAudioClipsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly telemetry: AudioMixTelemetryReporter,
  ) {}

  execute(clipIds: ReadonlyArray<string>, patch: AudioClipPatch): void {
    const current = this.store.snapshot().audio;
    const next = current.withClipsPatched(clipIds, patch);
    if (next === current) return;
    this.store.commit('Change sound', this.coalesceKeyOf(clipIds, patch));
    this.store.patch({ audio: next });
    if (this.turnedDucking(current, next, clipIds)) this.telemetry.duckingToggled(patch.ducking?.enabled === true);
  }

  /** Whether lowering under speech was turned on or off for some clip: a toggle, never the depth slider. */
  private turnedDucking(before: AudioMix, after: AudioMix, clipIds: ReadonlyArray<string>): boolean {
    return clipIds.some((clipId) => {
      const was = before.clip(clipId)?.ducking.enabled;
      const is = after.clip(clipId)?.ducking.enabled;
      return was !== undefined && is !== undefined && was !== is;
    });
  }

  /** The same clips and the same fields: what a drag repeats, and only that. */
  private coalesceKeyOf(clipIds: ReadonlyArray<string>, patch: AudioClipPatch): string {
    const { ducking, ...rest } = patch;
    const fields = [
      ...Object.keys(rest),
      ...Object.keys(ducking ?? {}).map((field) => `ducking.${field}`),
    ].sort();
    return `audioClipsPatch:${[...clipIds].sort().join(',')}:${fields.join(',')}`;
  }
}
