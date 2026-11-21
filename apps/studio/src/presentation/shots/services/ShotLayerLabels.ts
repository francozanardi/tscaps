import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';

/**
 * What a shot layer is called on screen, from what it shows: a video
 * is the shot's b-roll, the rest are named for what they are, and a
 * layer whose file is gone for what it lacks. The card's pills, the
 * inspector and the preview's boxes all say it the same way.
 */
export class ShotLayerLabels {
  /** `kind` is null for a file the open project's files do not hold. */
  labelOf(kind: ShotLayerAsset['kind'] | null): string {
    switch (kind) {
      case 'video':
        return 'B-roll';
      case 'image':
        return 'Picture';
      case 'gif':
        return 'GIF';
      case 'graphic':
        return 'Graphic';
      case null:
        return 'Missing file';
    }
  }

  /**
   * How many layers of which kinds, as a count reads: `3 b-rolls`,
   * `2 pictures`, `2 pictures and GIFs`, and `4 layers` once b-rolls
   * or graphics are mixed with anything else. `No layers` for none.
   */
  countOf(kinds: ReadonlyArray<ShotLayerAsset['kind']>): string {
    const count = kinds.length;
    if (count === 0) return 'No layers';
    const distinct = new Set(kinds);
    if (distinct.size === 1) return `${count} ${this.nounOf([...distinct][0]!, count)}`;
    if (distinct.has('video') || distinct.has('graphic')) return `${count} ${count === 1 ? 'layer' : 'layers'}`;
    return `${count} pictures and GIFs`;
  }

  /** The shots holding them by number, each once, in order: `Shot 2`, `Shots 1, 3, 4`. */
  shotsOf(shotNumbers: ReadonlyArray<number>): string {
    const distinct = [...new Set(shotNumbers)].sort((first, second) => first - second);
    return `${distinct.length === 1 ? 'Shot' : 'Shots'} ${distinct.join(', ')}`;
  }

  /** The shots a layer shows on, by the numbers of the first and the last: `Shot 2`, `Shots 2–4`. */
  runOf(firstShotNumber: number, lastShotNumber: number): string {
    return lastShotNumber > firstShotNumber ? `Shots ${firstShotNumber}–${lastShotNumber}` : `Shot ${firstShotNumber}`;
  }

  private nounOf(kind: ShotLayerAsset['kind'], count: number): string {
    const one = count === 1;
    switch (kind) {
      case 'video':
        return one ? 'b-roll' : 'b-rolls';
      case 'image':
        return one ? 'picture' : 'pictures';
      case 'gif':
        return one ? 'GIF' : 'GIFs';
      case 'graphic':
        return one ? 'graphic' : 'graphics';
    }
  }
}
