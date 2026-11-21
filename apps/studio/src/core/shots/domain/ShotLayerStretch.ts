/**
 * Where a layer shows once its shot is laid on the output: the output
 * stretch it covers, and the moment of its asset each pass starts from.
 * `sourcePassSec` is how long a pass runs before it starts over, or
 * `Infinity` when the asset plays straight through (or is still).
 */
export interface ShotLayerStretch {
  readonly outputStartSec: number;
  readonly outputEndSec: number;
  readonly sourceStartSec: number;
  readonly sourcePassSec: number;
}
