import type { Document, Word } from '@tscaps/engine';
import type { TagName } from '@core/tagging/domain/TagName';
import type { CutRange } from '@core/cuts/domain/CutRegistry';

const CUT_TAG_NAME: TagName = 'cut';

/**
 * Walks a Document and returns the time ranges that should be removed
 * to drop every bad-take stretch. A bad take is a maximal run of
 * consecutive words (in chronological order) tagged with the platform
 * `cut` semantic tag — fillers, restarts, and other aborted attempts
 * emitted upstream by the bad-take tagger. Each run becomes a single
 * range from the first word's start to the last word's end, so any
 * silence trapped strictly between two tagged words inside the same
 * run is removed as well — there is no surviving content in between
 * to keep alive.
 *
 * Each range is then extended into the silence that touches the
 * neighbouring surviving word, by the smaller of `paddingSec` and
 * half the available silence. Half-of-gap is a safety margin
 * against transcript timing imprecision: when the silence between
 * the bad take and the next word is short (a few tens of ms),
 * eating the whole gap clips the next word's onset because that
 * word's transcript start is optimistic. Leaving half of the gap
 * untouched preserves the onset and still catches the small audio
 * bleed that filler words like "em" leave just past their
 * transcript end whenever there is room.
 */
export class BadTakeFinder {

  constructor(private readonly paddingSec: number = 0.08) {}

  find(document: Document, videoDurationSec: number): CutRange[] {
    const words = document.getWords().sort((a, b) => {
      const startDelta = a.time.start - b.time.start;
      if (startDelta !== 0) return startDelta;
      return a.time.end - b.time.end;
    });
    const ranges: CutRange[] = [];
    let runStartIdx: number | null = null;
    let runEndIdx: number | null = null;
    for (let i = 0; i < words.length; i++) {
      if (words[i]!.hasTagName(CUT_TAG_NAME)) {
        if (runStartIdx === null) runStartIdx = i;
        runEndIdx = i;
        continue;
      }
      this.flushRun(ranges, words, runStartIdx, runEndIdx, videoDurationSec);
      runStartIdx = null;
      runEndIdx = null;
    }
    this.flushRun(ranges, words, runStartIdx, runEndIdx, videoDurationSec);
    return ranges;
  }

  private flushRun(
    ranges: CutRange[],
    words: ReadonlyArray<Word>,
    startIdx: number | null,
    endIdx: number | null,
    videoDurationSec: number,
  ): void {
    if (startIdx === null || endIdx === null) return;
    const first = words[startIdx]!;
    const last = words[endIdx]!;
    const prevWordEnd = startIdx > 0 ? words[startIdx - 1]!.time.end : 0;
    const nextWordStart = endIdx < words.length - 1 ? words[endIdx + 1]!.time.start : videoDurationSec;
    const padStart = Math.min(this.paddingSec, Math.max(0, first.time.start - prevWordEnd) / 2);
    const padEnd = Math.min(this.paddingSec, Math.max(0, nextWordStart - last.time.end) / 2);
    const startSec = first.time.start - padStart;
    const endSec = last.time.end + padEnd;
    if (endSec <= startSec) return;
    ranges.push({ startSec, endSec });
  }
}
