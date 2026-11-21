import type { Document, RenderTimeMap } from '@tscaps/engine';
import type { AudioTimeSpan } from '@core/audio-mix/domain/AudioTimeSpan';

/**
 * Reads where somebody speaks on the output: the Original track's words
 * in output time, merged across gaps shorter than
 * {@link SpeechSpanReader.MERGE_GAP_SEC} so a clip lowered under speech
 * does not pump up between two words. A word whose start is cut away is
 * not heard and holds no span.
 */
export class SpeechSpanReader {
  static readonly MERGE_GAP_SEC = 0.4;

  /** The stretches of speech, in output order, none overlapping or touching. */
  read(originalDocument: Document | null, timeMap: RenderTimeMap): AudioTimeSpan[] {
    const spoken = (originalDocument?.getWords() ?? [])
      .filter((word) => !timeMap.isSkipped(word.time.start))
      .map((word) => ({ startSec: timeMap.toOutputTime(word.time.start), endSec: timeMap.toOutputTime(word.time.end) }))
      .sort((a, b) => a.startSec - b.startSec);
    return this.merged(spoken);
  }

  private merged(spans: ReadonlyArray<AudioTimeSpan>): AudioTimeSpan[] {
    const merged: AudioTimeSpan[] = [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      if (last !== undefined && span.startSec - last.endSec < SpeechSpanReader.MERGE_GAP_SEC) {
        merged[merged.length - 1] = { startSec: last.startSec, endSec: Math.max(last.endSec, span.endSec) };
      } else {
        merged.push(span);
      }
    }
    return merged;
  }
}
