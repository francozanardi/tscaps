/** Who is in a take: one person, several (only one of them fits a narrower frame), or nobody. */
export type TakeContent = 'one person' | 'several people' | 'no person';

/**
 * What a frame shows: a description that finds it in the picture of its
 * take ("the person in the yellow raincoat on the left"), and a short name
 * for lists, the same for the same person or thing all through the video
 * ("the person in the raincoat").
 */
export interface FramedSubject {
  readonly description: string;
  readonly name: string;
}

/**
 * What the new frame shows in one take, as planned from a look at the
 * whole video: its subject as it looks in the picture, and, in a take
 * with several people whose speaker changes, when to switch to whom.
 */
export interface TakePlan {
  readonly take: number;
  readonly content: TakeContent;
  readonly subject: FramedSubject;
  /** Seconds of the source video; null where the take keeps one subject. */
  readonly switchAtSec: number | null;
  /** The subject from `switchAtSec` on; null where there is no switch. */
  readonly then: FramedSubject | null;
}
