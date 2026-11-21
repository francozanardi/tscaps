import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClipDraft } from '@core/audio-mix/domain/AudioClipDraft';
import type { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Adds several clips to the project's soundtrack at once, each under a
 * newly minted id with its role's defaults for what its draft leaves
 * out, and takes away the clips it is told to replace. All of it is one
 * undo step: a sound given to several layers together is one change.
 *
 * A draft anchored to a shot of the proposal makes the partition real
 * in the same step, the way any other edit of a shot does: the ids a
 * proposal shows are the ones it keeps, so the anchor names a shot that
 * stays. Drafts that cannot be added are skipped; nothing happens, and
 * no step is taken, where nothing would change.
 */
export class AddAudioClipsAction {
  constructor(
    private readonly store: EditorStore,
    private readonly defaults: AudioClipDefaults,
    private readonly shotPartitions: ShotPartitionMaterializer,
    private readonly telemetry: AudioMixTelemetryReporter,
  ) {}

  /** The ids of the clips added, in the order of their drafts. */
  execute(drafts: ReadonlyArray<AudioClipDraft>, replacedClipIds: Iterable<string> = []): string[] {
    const state = this.store.snapshot();
    const withoutReplaced = state.audio.withoutClips(replacedClipIds);
    let audio = withoutReplaced;
    const added: AudioClip[] = [];
    for (const draft of drafts) {
      const clip = this.defaults.clipFrom(crypto.randomUUID(), draft);
      const next = audio.withClipAdded(clip);
      if (next === audio) continue;
      audio = next;
      added.push(clip);
    }
    if (audio === state.audio) return [];
    const shots = drafts.some((draft) => this.namesShot(draft)) ? this.shotPartitions.materializeFrom(state) : state.shots;
    this.store.commit('Add sound');
    this.store.patch(shots === state.shots ? { audio } : { audio, shots });
    const replaced = withoutReplaced !== state.audio;
    for (const clip of added) if (clip.role === 'effect') this.telemetry.effectAdded(clip, replaced);
    return added.map((clip) => clip.id);
  }

  private namesShot(draft: AudioClipDraft): boolean {
    return this.isOnShot(draft.start) || this.isOnShot(draft.end);
  }

  private isOnShot(point: AudioAnchorPoint | null | undefined): boolean {
    return point?.anchor.kind === 'shot' || point?.anchor.kind === 'transition' || point?.anchor.kind === 'camera';
  }
}
