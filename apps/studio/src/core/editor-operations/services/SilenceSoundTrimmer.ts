import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { Silence } from '@core/cuts/domain/Silence';
import type { AudioLevels } from '@core/editor-operations/services/AudioLevels';
import type { CutAir, CutPace } from '@core/editor-operations/services/CutPace';

// The air a cut of words keeps next to its neighbours' times when the sound cannot help: this much, or this share of
// the gap when it is short (as SilencePadder).
const AIR_NEXT_TO_WORDS_SEC = 0.15;
const AIR_SHARE = 0.2;
// Margin taken off each side next to speech when the sound cannot say where words end.
const EXTRA_MARGIN_SEC = 0.15;
// A cut's edge stays this far outside the sound of the words it takes out.
const EDGE_CLEAR_SEC = 0.02;
// How far past a word's time its sound is looked for: it can go quiet before its time ends, or start after it.
const SOUND_SEARCH_SEC = 0.5;
// Words cut out must leave at least this much pause between the words around them, or those are pressed together.
const LEAST_PAUSE_LEFT_SEC = 0.2;

/**
 * Words to cut, as the transcript places them: their own span
 * (`spoken`), the stretch up to the neighbouring words (`zone`), whether
 * that stretch starts or ends the video, and whether it sits where one
 * sentence ends and the next begins.
 */
export interface WordCutZone {
  readonly spoken: CutRange;
  readonly zone: CutRange;
  readonly opensVideo: boolean;
  readonly closesVideo: boolean;
  readonly atSentenceBreak: boolean;
}

/**
 * A word cut made safe: what to cut (null to leave the words), and how
 * the sound changed it. `kept-as-air` leaves words whose cut would press
 * the words around them together.
 */
export interface TrimmedWordCut {
  readonly range: CutRange | null;
  readonly how: 'as-is' | 'smaller' | 'wider-margin' | 'left' | 'kept-as-air';
}

/**
 * The pauses to cut, and how many of those found were trimmed by the
 * sound, cut with extra margin, left too short to be worth a cut, or
 * left because sound fills them.
 */
export interface TrimmedSilences {
  readonly silences: ReadonlyArray<Silence>;
  readonly trimmed: number;
  readonly withExtraMargin: number;
  readonly skipped: number;
  readonly heldBySound: number;
}

/** A cut's edge on one side, and the pause it leaves to the word kept on that side. */
interface CutEdge {
  readonly sec: number;
  readonly pauseSec: number;
}

/**
 * Makes the pauses found from the transcript safe to cut with the sound.
 * The transcript says where the pauses are; the sound says where the
 * words around a pause really stop and start, and the cut keeps the
 * pace's air from that sound: more between sentences than inside one.
 * A cut is only ever made smaller, never larger, and one left taking
 * out less than the pace's least cut is not made. A pause with no quiet
 * in it at all is no silence (music, a voice the transcription missed,
 * a laugh): it is left. Under steady music or noise through the whole
 * video the sound cannot tell where words end, and a pause is cut with
 * an extra margin, or left when nothing is left of it. Cuts of words
 * follow the same rules over the words and the quiet around them.
 */
export class SilenceSoundTrimmer {
  trim(silences: ReadonlyArray<Silence>, levels: AudioLevels, durationSec: number, pace: CutPace): TrimmedSilences {
    const kept: Silence[] = [];
    let trimmed = 0;
    let withExtraMargin = 0;
    let skipped = 0;
    let heldBySound = 0;
    for (const silence of silences) {
      const { startSec, endSec } = silence.range;
      const opensVideo = startSec <= 0;
      const closesVideo = endSec >= durationSec - 1e-6;
      if (!levels.hasSteadyBackground && !levels.hasQuietWithin(silence.range)) {
        heldBySound += 1;
        continue;
      }
      const blind = levels.hasSteadyBackground;
      const air = silence.isInterSentence ? pace.betweenSentences : pace.withinSentence;
      const range = blind
        ? this.withMargin(silence.range, opensVideo, closesVideo)
        : this.withAir(silence.range, levels, air, opensVideo, closesVideo);
      if (range === null || range.endSec - range.startSec < pace.minCutSec) {
        skipped += 1;
        continue;
      }
      if (blind) withExtraMargin += 1;
      else if (range.startSec !== startSec || range.endSec !== endSec) trimmed += 1;
      kept.push({ ...silence, range });
    }
    return { silences: kept, trimmed, withExtraMargin, skipped, heldBySound };
  }

  /**
   * A cut of words made safe with the sound. Word times can be short or
   * late, so the cut may take the words and the quiet around them, up to
   * the neighbouring words (`zone`): it takes all of the words' own sound
   * and keeps the pace's air from the neighbours' sound, as for a pause.
   * The words are left (`range` null) when no quiet separates them from
   * a neighbour, when the cut cannot take all of their sound, or when it
   * would leave the words around them less than a fifth of a second
   * apart; and cut with a wider margin from the neighbours when steady
   * sound hides where words end.
   */
  trimWordCut(cut: WordCutZone, levels: AudioLevels | null, pace: CutPace): TrimmedWordCut {
    const zone = this.airedZone(cut);
    if (levels === null) return { range: zone, how: 'as-is' };
    if (levels.hasSteadyBackground) return { range: this.widerFromNeighbours(zone, cut), how: 'wider-margin' };
    const air = cut.atSentenceBreak ? pace.betweenSentences : pace.withinSentence;
    const start = cut.opensVideo ? { sec: zone.startSec, pauseSec: Number.POSITIVE_INFINITY } : this.startAfterWordBefore(cut, zone, levels, air);
    const end = cut.closesVideo ? { sec: zone.endSec, pauseSec: Number.POSITIVE_INFINITY } : this.endBeforeWordAfter(cut, zone, levels, air);
    if (start === null || end === null) return { range: null, how: 'left' };
    const middle = (cut.spoken.startSec + cut.spoken.endSec) / 2;
    if (!(start.sec < middle && middle < end.sec)) return { range: null, how: 'left' };
    if (start.pauseSec + end.pauseSec < LEAST_PAUSE_LEFT_SEC) return { range: null, how: 'kept-as-air' };
    const changed = start.sec !== zone.startSec || end.sec !== zone.endSec;
    return { range: { startSec: start.sec, endSec: end.sec }, how: changed ? 'smaller' : 'as-is' };
  }

  /**
   * Where a cut of words starts: `air` after the sound of the word
   * before, but before the words' own sound starts; null when no quiet
   * follows the word before, or the zone starts inside the words' sound.
   */
  private startAfterWordBefore(cut: WordCutZone, zone: CutRange, levels: AudioLevels, air: CutAir): CutEdge | null {
    const soundEnd = this.soundEndAround(levels, cut.zone.startSec, cut.spoken.endSec);
    if (soundEnd === null) return null;
    const ownStart = levels.soundStartAfter(soundEnd, cut.spoken.endSec) ?? (cut.spoken.startSec + cut.spoken.endSec) / 2;
    const sec = Math.max(zone.startSec, Math.min(soundEnd + air.afterWordSec, ownStart - EDGE_CLEAR_SEC));
    return sec > ownStart ? null : { sec, pauseSec: sec - soundEnd };
  }

  /** Where a cut of words ends, as `startAfterWordBefore` mirrored: `air` before the sound of the word after. */
  private endBeforeWordAfter(cut: WordCutZone, zone: CutRange, levels: AudioLevels, air: CutAir): CutEdge | null {
    const soundStart = this.soundStartAround(levels, cut.zone.endSec, cut.spoken.startSec);
    if (soundStart === null) return null;
    const ownEnd = levels.soundEndBefore(soundStart, cut.spoken.startSec) ?? (cut.spoken.startSec + cut.spoken.endSec) / 2;
    const sec = Math.min(zone.endSec, Math.max(soundStart - air.beforeWordSec, ownEnd + EDGE_CLEAR_SEC));
    return sec < ownEnd ? null : { sec, pauseSec: soundStart - sec };
  }

  /** The zone with the air a pause keeps next to each neighbouring word, never cutting into the words' own span. */
  private airedZone(cut: WordCutZone): CutRange {
    const before = Math.max(0, cut.spoken.startSec - cut.zone.startSec);
    const after = Math.max(0, cut.zone.endSec - cut.spoken.endSec);
    return {
      startSec: Math.min(cut.spoken.startSec, cut.zone.startSec + (cut.opensVideo ? 0 : Math.min(AIR_NEXT_TO_WORDS_SEC, before * AIR_SHARE))),
      endSec: Math.max(cut.spoken.endSec, cut.zone.endSec - (cut.closesVideo ? 0 : Math.min(AIR_NEXT_TO_WORDS_SEC, after * AIR_SHARE))),
    };
  }

  private widerFromNeighbours(zone: CutRange, cut: WordCutZone): CutRange {
    return {
      startSec: cut.opensVideo ? zone.startSec : Math.min(cut.spoken.startSec, zone.startSec + EXTRA_MARGIN_SEC),
      endSec: cut.closesVideo ? zone.endSec : Math.max(cut.spoken.endSec, zone.endSec - EXTRA_MARGIN_SEC),
    };
  }

  /** `range` made smaller where needed to keep `air` from the sound of the words around it; null when nothing is left. */
  private withAir(range: CutRange, levels: AudioLevels, air: CutAir, opensVideo: boolean, closesVideo: boolean): CutRange | null {
    let { startSec, endSec } = range;
    if (!opensVideo) {
      const soundEnd = this.soundEndAround(levels, range.startSec, range.endSec);
      if (soundEnd === null) return null;
      startSec = Math.max(startSec, soundEnd + air.afterWordSec);
    }
    if (!closesVideo) {
      const soundStart = this.soundStartAround(levels, range.endSec, range.startSec);
      if (soundStart === null) return null;
      endSec = Math.min(endSec, soundStart - air.beforeWordSec);
    }
    return endSec > startSec ? { startSec, endSec } : null;
  }

  /**
   * Where the sound before `sec` really ends: where quiet starts, when it
   * runs past `sec`, or where it went quiet before `sec`. Null when no
   * quiet comes before `untilSec`.
   */
  private soundEndAround(levels: AudioLevels, sec: number, untilSec: number): number | null {
    const quiet = levels.quietStartAfter(sec, untilSec);
    if (quiet === null) return null;
    return levels.soundEndBefore(quiet, sec - SOUND_SEARCH_SEC) ?? sec - SOUND_SEARCH_SEC;
  }

  /**
   * Where the sound after `sec` really starts: where quiet ends, when it
   * starts before `sec`, or where it starts after `sec`. Null when no
   * quiet comes after `fromSec`.
   */
  private soundStartAround(levels: AudioLevels, sec: number, fromSec: number): number | null {
    const quiet = levels.quietEndBefore(sec, fromSec);
    if (quiet === null) return null;
    return levels.soundStartAfter(quiet, sec + SOUND_SEARCH_SEC) ?? sec + SOUND_SEARCH_SEC;
  }

  private withMargin(range: CutRange, opensVideo: boolean, closesVideo: boolean): CutRange {
    return {
      startSec: range.startSec + (opensVideo ? 0 : EXTRA_MARGIN_SEC),
      endSec: range.endSec - (closesVideo ? 0 : EXTRA_MARGIN_SEC),
    };
  }
}
