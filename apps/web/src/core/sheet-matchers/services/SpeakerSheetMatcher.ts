import type { Document, Segment } from '@tscaps/engine';
import type {
  SheetMatcher,
  SheetMatcherAvailability,
  SheetMatcherContext,
} from '@core/sheet-matchers/domain/SheetMatcher';

export interface SpeakerSheetMatcherParams {
  /** Speaker id to match. `null` targets words without speaker attribution. */
  readonly speakerId: string | null;
}

/**
 * Identifiers for the conditions that block this matcher. The dialog
 * maps each one to a user-facing message; codes here stay free of UI
 * copy so the core can change wording without changing logic.
 *
 * `insufficient-speakers` — fewer than two distinct speakers detected;
 * the matcher has nothing meaningful to discriminate by.
 *
 * `mixed-speaker-segments` — at least one segment spans multiple
 * speakers, so it could never match any single-speaker target. Symptom
 * of an upstream pipeline that didn't split by speaker change; the
 * dialog points the user at the relevant control.
 */
export type SpeakerSheetMatcherUnavailableCode =
  | 'insufficient-speakers'
  | 'mixed-speaker-segments';

/**
 * Matches segments whose every word carries the same `speakerId`. After
 * the engine's `SpeakerChangeSegmentSplitter` runs, segments are already
 * mono-speaker so the check is exact rather than majority-based.
 */
export class SpeakerSheetMatcher implements SheetMatcher<SpeakerSheetMatcherParams> {
  readonly type = 'speaker';
  readonly label = 'By speaker';

  availability(ctx: SheetMatcherContext): SheetMatcherAvailability {
    const speakerIds = this.collectSpeakerIds(ctx.document);
    if (speakerIds.length < 2) {
      return { available: false, code: 'insufficient-speakers' satisfies SpeakerSheetMatcherUnavailableCode };
    }
    if (this._hasMixedSpeakerSegments(ctx.document)) {
      return { available: false, code: 'mixed-speaker-segments' satisfies SpeakerSheetMatcherUnavailableCode };
    }
    return { available: true };
  }

  defaultParams(ctx: SheetMatcherContext): SpeakerSheetMatcherParams {
    const ids = this.collectSpeakerIds(ctx.document);
    return { speakerId: ids[0] ?? null };
  }

  matches(segment: Segment, params: SpeakerSheetMatcherParams): boolean {
    const words = segment.getWords();
    if (words.length === 0) return false;
    return words.every((w) => w.speakerId === params.speakerId);
  }

  /**
   * Distinct speaker ids carried by the document's words, in order of
   * first appearance. `null` (words without speaker attribution) is
   * preserved as an explicit entry so it can be targeted by the matcher.
   * Public because the speaker picker in the dialog enumerates it to
   * populate its options.
   */
  collectSpeakerIds(document: Document): (string | null)[] {
    const seen = new Set<string | null>();
    const ordered: (string | null)[] = [];
    for (const segment of document.getSegments()) {
      for (const word of segment.getWords()) {
        if (seen.has(word.speakerId)) continue;
        seen.add(word.speakerId);
        ordered.push(word.speakerId);
      }
    }
    return ordered;
  }

  private _hasMixedSpeakerSegments(document: Document): boolean {
    for (const segment of document.getSegments()) {
      const words = segment.getWords();
      if (words.length === 0) continue;
      const first = words[0]!.speakerId;
      for (let i = 1; i < words.length; i++) {
        if (words[i]!.speakerId !== first) return true;
      }
    }
    return false;
  }
}
