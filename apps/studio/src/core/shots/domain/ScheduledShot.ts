/** A shot that reaches the output: the stretch of the output it shows over. */
export interface ScheduledShot {
  readonly shotId: string;
  readonly outputStartSec: number;
  readonly outputEndSec: number;
}
