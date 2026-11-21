import type { RenderTimeMap } from '@tscaps/engine';

/** Where a shot starts and ends, in source time. */
interface ShotSourceSpan {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * How long each shot of a video plays in the output, once cuts collapse,
 * and how long a run of consecutive shots does. A shot cut away whole
 * plays for zero seconds.
 */
export class ShotOutputLengths {
  private constructor(private readonly lengthsSec: ReadonlyArray<number>) {}

  /** `shots` are the video's shots in order, each in source time. */
  static of(shots: ReadonlyArray<ShotSourceSpan>, timeMap: RenderTimeMap): ShotOutputLengths {
    return new ShotOutputLengths(shots.map((shot) => (
      Math.max(0, timeMap.toOutputTime(shot.endSec) - timeMap.toOutputTime(shot.startSec))
    )));
  }

  /** Each shot's length, in seconds, in the order the shots were given. */
  list(): ReadonlyArray<number> {
    return this.lengthsSec;
  }

  /** How long the shots from `fromIndex` through `throughIndex` play together; 0 where the span holds none. */
  runSec(fromIndex: number, throughIndex: number): number {
    return this.lengthsSec
      .slice(Math.max(0, fromIndex), throughIndex + 1)
      .reduce((total, lengthSec) => total + lengthSec, 0);
  }

  /** How long the whole video plays. */
  totalSec(): number {
    return this.runSec(0, this.lengthsSec.length - 1);
  }
}
