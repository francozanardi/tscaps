/**
 * A moment a graphic's code says something happens in it — a button
 * pressed, a heart liked — that a sound can be placed on: its id, its name
 * as the Sound tab shows it, and when it happens, in seconds after the
 * graphic comes in.
 */
export interface GraphicMoment {
  readonly id: string;
  readonly label: string;
  readonly sec: number;
}
