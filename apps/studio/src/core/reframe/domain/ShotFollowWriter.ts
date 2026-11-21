import type { ShotFollow } from '@core/shots/domain/ShotFollow';

/** Has a shot's own video follow a person, or stop following one (`follow` null), as one undo step. */
export interface ShotFollowWriter {
  execute(shotId: string, follow: ShotFollow | null): void;
}
