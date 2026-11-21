/** How long a shot may run before one has to be cut. */
export interface ShotLengthBudget {
  readonly maxSec: number;
  /** A shot shorter than this is not worth cutting to. */
  readonly minSec: number;
}
