/**
 * What a frame is put on: a person the take's survey found, by their
 * letter, or a point of the source picture (each axis a share of it; `y`
 * null to leave the height to the frame).
 */
export type SubjectChoice =
  | { readonly kind: 'person'; readonly letter: string }
  | { readonly kind: 'point'; readonly x: number; readonly y: number | null };

/**
 * How a stretch is framed, as chosen by whoever looked at it: its
 * subject, how close (1 is the frame's own closeness; null to let the
 * subject's size decide), and a short name for the subject in lists
 * (null for a name made from the choice).
 */
export interface FramingChoice {
  readonly subject: SubjectChoice;
  readonly closeness: number | null;
  readonly name: string | null;
}

/** A change of subject inside a take: from `atSec` of the source video on, the frame shows this choice. */
export interface ChoiceSwitch extends FramingChoice {
  readonly atSec: number;
}

/** What one take shows: a choice from its start, and each switch to another inside it. */
export interface TakeChoice extends FramingChoice {
  readonly take: number;
  readonly switches: ReadonlyArray<ChoiceSwitch>;
}
