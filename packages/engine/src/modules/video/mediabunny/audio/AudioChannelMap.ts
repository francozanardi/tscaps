/**
 * How the channels of a source fold into the channels of a target. A
 * mono source feeds every target channel at full level; a mono target
 * takes the average of every source channel; otherwise target channel
 * `c` takes the average of the source channels whose index modulo the
 * target count is `c`, which is the identity when the counts match.
 */
export class AudioChannelMap {

  private readonly sources: ReadonlyArray<ReadonlyArray<number>>;

  constructor(sourceChannels: number, readonly targetChannels: number) {
    const sources: number[][] = [];
    for (let target = 0; target < targetChannels; target++) {
      sources.push(this.sourcesFor(target, sourceChannels, targetChannels));
    }
    this.sources = sources;
  }

  /** The source channels folded into `targetChannel`. */
  sourcesOf(targetChannel: number): ReadonlyArray<number> {
    return this.sources[targetChannel] ?? [];
  }

  /** The level each of {@link sourcesOf}'s channels joins `targetChannel` at. */
  weightOf(targetChannel: number): number {
    const count = this.sourcesOf(targetChannel).length;
    return count === 0 ? 0 : 1 / count;
  }

  private sourcesFor(target: number, sourceChannels: number, targetChannels: number): number[] {
    if (sourceChannels <= 1) return sourceChannels === 1 ? [0] : [];
    const sources: number[] = [];
    for (let source = 0; source < sourceChannels; source++) {
      if (targetChannels === 1 || source % targetChannels === target) sources.push(source);
    }
    return sources;
  }
}
