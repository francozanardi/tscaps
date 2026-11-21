/** What uses one media file in the open project. */
export interface MediaFileUsage {
  /** How many shots show it; a shot showing it twice counts once. */
  readonly shots: number;
  /** Whether it is the project's music. */
  readonly isMusic: boolean;
  /** How many sound effects play it. */
  readonly soundEffects: number;
}
