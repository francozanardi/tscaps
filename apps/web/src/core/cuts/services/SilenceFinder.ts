import type { Document, Segment } from '@tscaps/engine';
import type { Silence } from '@core/cuts/domain/Silence';
import {
  REMOVE_SILENCES_PRESET_THRESHOLDS,
  type RemoveSilencesPreset,
  type SilenceThresholds,
} from '@core/cuts/domain/RemoveSilencesPreset';
import { SilencePadder } from '@core/cuts/services/SilencePadder';

/**
 * Walks a Document chronologically and collects every silent stretch
 * that qualifies for removal under a given preset. A silence is
 * intra-sentence when it sits between two words of the same segment,
 * and inter-sentence when it sits between two segments or at the
 * video's lead-in or tail-out edge. The two categories are tested
 * against independent thresholds so a preset can cut hesitations
 * inside a sentence while preserving the natural pauses between
 * sentences.
 *
 * Each emitted silence carries the padded range produced by the
 * shared padder, so a preset committing it as a cut yields the same
 * range a user would get by clicking the same silence on the
 * timeline.
 */
export class SilenceFinder {

  constructor(private readonly padder: SilencePadder) {}

  findForPreset(document: Document, videoDurationSec: number, preset: RemoveSilencesPreset): Silence[] {
    return this.find(document, videoDurationSec, REMOVE_SILENCES_PRESET_THRESHOLDS[preset]);
  }

  private find(document: Document, videoDurationSec: number, thresholds: SilenceThresholds): Silence[] {
    const segments = document.getSegments().sort((a, b) => {
      const startDelta = a.time.start - b.time.start;
      if (startDelta !== 0) return startDelta;
      return a.time.end - b.time.end;
    });
    const silences: Silence[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const next = segments[i + 1];
      const rowStartSec = i === 0 ? 0 : segment.time.start;
      const rowEndSec = next ? next.time.start : Math.max(segment.time.end, videoDurationSec);
      this.collectFromSegment(silences, segment, rowStartSec, rowEndSec, i === 0, !next, thresholds);
    }
    return silences;
  }

  private collectFromSegment(
    silences: Silence[],
    segment: Segment,
    rowStartSec: number,
    rowEndSec: number,
    isFirstSegment: boolean,
    isLastSegment: boolean,
    thresholds: SilenceThresholds,
  ): void {
    const words = segment.getWords();
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (firstWord) {
      this.appendIfQualifies(
        silences,
        rowStartSec,
        firstWord.time.start,
        isFirstSegment,
        isFirstSegment,
        false,
        thresholds,
      );
    }
    for (let j = 0; j < words.length - 1; j++) {
      const word = words[j]!;
      const nextWord = words[j + 1]!;
      this.appendIfQualifies(silences, word.time.end, nextWord.time.start, false, false, false, thresholds);
    }
    if (lastWord) {
      this.appendIfQualifies(silences, lastWord.time.end, rowEndSec, true, false, isLastSegment, thresholds);
    }
  }

  private appendIfQualifies(
    silences: Silence[],
    rawStartSec: number,
    rawEndSec: number,
    isInterSentence: boolean,
    atVideoLeadingEdge: boolean,
    atVideoTrailingEdge: boolean,
    thresholds: SilenceThresholds,
  ): void {
    const minSec = isInterSentence ? thresholds.interSentenceMinSec : thresholds.intraSentenceMinSec;
    if (rawEndSec - rawStartSec < minSec) return;
    const range = this.padder.pad(rawStartSec, rawEndSec, atVideoLeadingEdge, atVideoTrailingEdge);
    if (!range) return;
    silences.push({ range, isInterSentence });
  }
}
