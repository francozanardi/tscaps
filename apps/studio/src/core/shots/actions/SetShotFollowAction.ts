import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/**
 * Has a shot's own video follow a person, or stop following one, as one
 * undo step. A proposed shot is made real first, as every edit of a
 * shot makes it. What the shot's camera was given stays: its closeness
 * is the crop the person is followed in.
 */
export class SetShotFollowAction {
  constructor(
    private readonly store: EditorStore,
    private readonly materializer: ShotPartitionMaterializer,
  ) {}

  /** `follow` null stops the shot following anyone; a shot that follows no one and is told to stop is left as it is. */
  execute(shotId: string, follow: ShotFollow | null): void {
    const current = this.materializer.materializeFrom(this.store.snapshot());
    const held = current.list().find((shot) => shot.id === shotId);
    if (held === undefined || (follow === null && held.follow === undefined)) return;
    const shots = current.withFollow(shotId, follow);
    this.store.commit(follow === null ? 'Stop following' : 'Follow a person');
    this.store.patch({ shots });
  }
}
