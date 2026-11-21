import type { RenderTimeMap } from '@tscaps/engine';

/**
 * Lengths of the video as it plays once its cuts collapse, asked in
 * source time: a stretch cut away counts for nothing.
 */
export class OutputLengths {
  constructor(
    private readonly timeMap: RenderTimeMap,
    private readonly outputEndSec: number,
  ) {}

  /** How long the output plays from source time `fromSec` to `toSec`. */
  between(fromSec: number, toSec: number): number {
    return this.timeMap.toOutputTime(toSec) - this.timeMap.toOutputTime(fromSec);
  }

  /** How long the output plays from source time `fromSec` to its end. */
  after(fromSec: number): number {
    return this.outputEndSec - this.timeMap.toOutputTime(fromSec);
  }
}
