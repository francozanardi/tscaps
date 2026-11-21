import { z } from 'zod';
import type { AddCutAction } from '@core/cuts/actions/AddCutAction';
import type { RemoveSilencesAction } from '@core/cuts/actions/RemoveSilencesAction';
import type { RestoreCutsRangeAction } from '@core/cuts/actions/RestoreCutsRangeAction';
import type { CutRange, CutRegistry } from '@core/cuts/domain/CutRegistry';
import { REMOVE_SILENCES_PRESETS, type RemoveSilencesPreset } from '@core/cuts/domain/RemoveSilencesPreset';
import type { SilenceFinder } from '@core/cuts/services/SilenceFinder';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { AudioLevels } from '@core/editor-operations/services/AudioLevels';
import type { AudioLevelsReader } from '@core/editor-operations/services/AudioLevelsReader';
import { CUT_PACES, type CutPace } from '@core/editor-operations/services/CutPace';
import type { SilenceSoundTrimmer, TrimmedSilences, WordCutZone } from '@core/editor-operations/services/SilenceSoundTrimmer';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/** A stretch as the input names it, in seconds of the source video. */
interface StretchInput {
  readonly startSec: number;
  readonly endSec: number;
}

/** A run of words to cut, where the transcript places it, what it says, and whether it starts or ends a sentence. */
interface WordRun {
  readonly text: string;
  readonly spoken: StretchInput;
  readonly zone: StretchInput;
  readonly atSentenceBreak: boolean;
}

/** What became of the word cuts asked for. */
interface WordCutsDone {
  readonly cut: number;
  readonly madeSmallerBySound: number;
  readonly cutWithWiderMargin: number;
  readonly left: ReadonlyArray<string>;
  readonly keptAsAir: ReadonlyArray<string>;
}

const STRETCH = z.strictObject({
  startSec: z.number().min(0).describe('Where it starts, in seconds of the source video.'),
  endSec: z.number().min(0).describe('Where it ends, in seconds of the source video; past the video\'s end reads as its end.'),
});

/**
 * `cut_video`: removes stretches of the source video, brings cut ones
 * back, and removes the pauses in the speech with one of the editor's
 * presets — restore first, then cut, then the pauses — refusing all of
 * it where a stretch is out of the video or the cuts would leave
 * nothing to play. Pauses come from the gaps between the words and are
 * only ever made smaller by the sound, which also sets the air each cut
 * keeps next to the words; a cut whose edge falls in sound is answered
 * with a warning.
 */
export class CutVideoOperation implements EditorOperation {
  readonly name = 'cut_video';
  readonly effect = 'edit';
  readonly description = [
    'Remove stretches of the video (cut), bring cut stretches back (restore), or remove the pauses in the speech (removeSilences); given together they run in that order: restore, cut, then pauses.',
    'Times are seconds of the source video, the timeline the transcript\'s word times are on: a cut changes no word time and no ref, it only skips what it covers on playback and export.',
    '`cutWords` cuts words by ref (a filler, a false start, a repeated take), each run of neighbouring words as one stretch with the quiet around it, keeping the air of removeSilences\' pace (natural when not given).',
    'removeSilences cuts only inside the quiet between the words, and removes no pause where steady music or noise runs under the voice unless overSteadySound is given.',
    'The answer says what was cut, what was left and why, and warns about any cut edge left in sound.',
  ].join(' ');

  private readonly input = new OperationInput({
    cut: z.array(STRETCH).max(50).optional().describe('Stretches to remove; one touching or overlapping a cut joins it.'),
    cutWords: z.array(z.string()).max(200).optional().describe('Words to cut from the video, as refs: word:<id>. Runs of neighbouring words are cut as one stretch.'),
    restore: z.array(STRETCH).max(50).optional().describe('Stretches to bring back: every cut over them is taken off there, a cut around one split in two.'),
    removeSilences: z.enum(REMOVE_SILENCES_PRESETS).optional()
      .describe('Removes the pauses in the speech: natural cuts only long ones and leaves about 0.3 s of pause inside a sentence and 0.45 s between sentences; fast and faster cut shorter ones and leave less.'),
    overSteadySound: z.boolean().optional()
      .describe('With removeSilences: remove the pauses even where steady music or noise runs under the voice, which jumps at every cut. Only when the person asked for it knowing that.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly captions: CaptionRefResolver,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly silenceFinder: SilenceFinder,
    private readonly addCut: AddCutAction,
    private readonly restoreRange: RestoreCutsRangeAction,
    private readonly removeSilences: RemoveSilencesAction,
    private readonly audio: AudioLevelsReader,
    private readonly trimmer: SilenceSoundTrimmer,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { restore = [], cutWords = [], removeSilences: preset, overSteadySound = false } = checked.value;
    const words = this.wordRuns(cutWords);
    if (!words.ok) return this.refused(words.problems);
    const cut = checked.value.cut ?? [];
    if (cut.length === 0 && words.runs.length === 0 && restore.length === 0 && preset === undefined) return this.refusedFor('Give cut, cutWords, restore or removeSilences.');
    const state = this.store.snapshot();
    const durationSec = state.video.duration;
    if (!(durationSec > 0)) return this.refusedFor('The video\'s length is not known yet, so nothing can be cut.');
    // Words are checked as words: one timed as an instant (a cut-off "a-") is still cut with the quiet around it.
    const problems = [...this.stretchProblems(restore, 'restore', durationSec), ...this.stretchProblems(cut, 'cut', durationSec)];
    if (preset !== undefined && this.originalCaptions.read(state).document === null) {
      problems.push(this.problem('removeSilences: the project has no transcript to find the pauses in.'));
    }
    if (problems.length > 0) return this.refused(problems);
    const levels = await this.audio.read();
    const restored = restore.map((stretch) => this.rangeOf(stretch, durationSec));
    const byTime = cut.map((stretch) => this.rangeOf(stretch, durationSec));
    const wordCuts = this.wordCuts(words.runs, durationSec, levels, CUT_PACES[preset ?? 'natural']);
    const removed = [...byTime, ...wordCuts.ranges];
    if (this.planned(state.cuts, restored, removed).uncutSpans(durationSec).length === 0) {
      return this.refusedFor('That would cut the whole video: leave something to play.');
    }
    const heldOverSteadySound = preset !== undefined && levels?.hasSteadyBackground === true && !overSteadySound;
    if (heldOverSteadySound && removed.length === 0 && restored.length === 0) return this.refused([this.steadySoundHeld()]);
    for (const range of restored) this.restoreRange.execute(range);
    for (const range of removed) this.addCut.execute(range);
    const pauses = preset === undefined || heldOverSteadySound ? null : this.newSilences(preset, durationSec, levels);
    if (pauses !== null && pauses.silences.length > 0) this.removeSilences.execute(pauses.silences);
    const answer = this.answered(durationSec, pauses, words.runs.length === 0 ? null : wordCuts.done);
    return {
      ...answer,
      problems: [
        ...this.clippedEdges(byTime, durationSec, levels),
        ...this.wordNotes(wordCuts.done, levels),
        ...(heldOverSteadySound ? [this.steadySoundHeld()] : []),
        ...(pauses === null ? [] : this.pauseNotes(pauses, levels)),
      ],
    };
  }

  /** Why no pause was removed: steady sound under the voice would jump at every cut. */
  private steadySoundHeld(): OperationProblem {
    return this.problem('removeSilences: steady music or noise runs under the voice, so every cut would make it jump: no pause was removed. Tell the person; remove them only if they ask for it knowing that, with overSteadySound: true.');
  }

  private wordNotes(done: WordCutsDone, levels: AudioLevels | null): OperationProblem[] {
    const notes: OperationProblem[] = [];
    if (done.left.length > 0) {
      notes.push({
        severity: 'warning',
        message: `Not cut, since no quiet separates them from the next or the last word: ${done.left.join(', ')}. Leave them and say so; cut by time inside the quiet get_audio shows only if the person asks for that word gone.`,
      });
    }
    if (done.keptAsAir.length > 0) {
      notes.push({
        severity: 'warning',
        message: `Kept, since cutting them would leave the words around them under a fifth of a second apart, pressed together: ${done.keptAsAir.join(', ')}. That pause is the line's air: leave them and say so.`,
      });
    }
    if (done.cutWithWiderMargin > 0) {
      notes.push({
        severity: 'warning',
        message: 'Steady sound (music or noise) under the voice hides where words end, so the words were cut by their times with a margin from their neighbours; part of a word may remain or be clipped, and that sound jumps at each cut.',
      });
    }
    if (levels === null && done.cut > 0) notes.push(this.noSound());
    return notes;
  }

  private pauseNotes(pauses: TrimmedSilences, levels: AudioLevels | null): OperationProblem[] {
    if (levels === null) return [this.noSound()];
    const held: OperationProblem[] = pauses.heldBySound === 0 ? [] : [{
      severity: 'warning',
      message: `${pauses.heldBySound} pause${pauses.heldBySound === 1 ? '' : 's'} left: sound runs all through ${pauses.heldBySound === 1 ? 'it' : 'them'} (music, a laugh, a voice the transcription missed), so ${pauses.heldBySound === 1 ? 'it is' : 'they are'} not silence.`,
    }];
    if (!levels.hasSteadyBackground) return held;
    return [...held, {
      severity: 'warning',
      message: 'Steady sound (music or noise) under the voice hides where words end, so each pause was cut with a wider margin, or left when too short; a word may still be clipped where the word times are off, and that sound jumps at each cut.',
    }];
  }

  /** Warnings for the edges of `removed` that fall where sound runs across them, by `levels`. */
  private clippedEdges(removed: ReadonlyArray<CutRange>, durationSec: number, levels: AudioLevels | null): OperationProblem[] {
    if (levels === null || levels.hasSteadyBackground) return [];
    return removed.flatMap((range) => {
      const edges = [range.startSec, range.endSec].filter((sec) => sec > 0 && sec < durationSec && levels.soundRunsAcross(sec));
      if (edges.length === 0) return [];
      const at = edges.map((sec) => `${this.rounded(sec)} s`).join(' and ');
      return [{
        severity: 'warning' as const,
        message: `The cut ${this.rounded(range.startSec)}-${this.rounded(range.endSec)} s ends in sound at ${at}, likely a word (or music or noise, which read the same): read get_audio around it and move the edge into quiet; where the words run together with no quiet between them, leave it and say so in your answer.`,
      }];
    });
  }

  private noSound(): OperationProblem {
    return {
      severity: 'warning',
      message: 'The video\'s sound could not be read, so the pauses were cut by the word times alone, which are approximate: a word may be clipped.',
    };
  }

  /**
   * The runs of neighbouring words `refs` names, each with its own span
   * and the stretch up to the words around it; or why some refs name no word.
   */
  private wordRuns(refs: ReadonlyArray<string>): { ok: true; runs: WordRun[] } | { ok: false; problems: OperationProblem[] } {
    const resolved = refs.map((ref) => this.captions.resolve(ref, ['word']));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return { ok: false, problems };
    const wanted = new Set(resolved.flatMap((each) => (each.ok ? [each.value.id] : [])));
    const document = this.store.snapshot().document;
    const words = document?.getWords() ?? [];
    const sentenceEdges = new Set((document?.getSegments() ?? []).flatMap((segment) => {
      const inSegment = segment.getWords();
      return inSegment.length === 0 ? [] : [inSegment[0]!.id, inSegment[inSegment.length - 1]!.id];
    }));
    const runs: WordRun[] = [];
    let first = -1;
    for (let index = 0; index <= words.length; index += 1) {
      if (index < words.length && wanted.has(words[index]!.id)) {
        if (first < 0) first = index;
        continue;
      }
      if (first < 0) continue;
      const run = words.slice(first, index);
      const before = words[first - 1];
      const after = words[index];
      runs.push({
        text: run.map((word) => word.text).join(' '),
        spoken: { startSec: run[0]!.time.start, endSec: run[run.length - 1]!.time.end },
        zone: {
          startSec: Math.min(run[0]!.time.start, before?.time.end ?? 0),
          endSec: Math.max(run[run.length - 1]!.time.end, after?.time.start ?? Number.POSITIVE_INFINITY),
        },
        atSentenceBreak: sentenceEdges.has(run[0]!.id) || sentenceEdges.has(run[run.length - 1]!.id),
      });
      first = -1;
    }
    return { ok: true, runs };
  }

  /** Each run of words cut as the sound and `pace` allow, and what became of them. */
  private wordCuts(runs: ReadonlyArray<WordRun>, durationSec: number, levels: AudioLevels | null, pace: CutPace): { ranges: CutRange[]; done: WordCutsDone } {
    const ranges: CutRange[] = [];
    const left: string[] = [];
    const keptAsAir: string[] = [];
    let smaller = 0;
    let wider = 0;
    for (const run of runs) {
      const zone: WordCutZone = {
        spoken: this.rangeOf(run.spoken, durationSec),
        zone: this.rangeOf(run.zone, durationSec),
        opensVideo: run.zone.startSec <= 0,
        closesVideo: run.zone.endSec >= durationSec,
        atSentenceBreak: run.atSentenceBreak,
      };
      const trimmed = this.trimmer.trimWordCut(zone, levels, pace);
      if (trimmed.range === null) {
        (trimmed.how === 'kept-as-air' ? keptAsAir : left).push(`"${run.text}" (${this.rounded(run.spoken.startSec)} s)`);
        continue;
      }
      if (trimmed.how === 'smaller') smaller += 1;
      if (trimmed.how === 'wider-margin') wider += 1;
      ranges.push(trimmed.range);
    }
    return { ranges, done: { cut: ranges.length, madeSmallerBySound: smaller, cutWithWiderMargin: wider, left, keptAsAir } };
  }

  private stretchProblems(stretches: ReadonlyArray<StretchInput>, field: string, durationSec: number): OperationProblem[] {
    return stretches.flatMap((stretch, index) => {
      const path = `${field}.${index}`;
      if (!(stretch.endSec > stretch.startSec)) return [this.problem(`${path}: endSec must be after startSec.`)];
      if (stretch.startSec >= durationSec) return [this.problem(`${path}: starts at or past the video's end (${this.rounded(durationSec)} s).`)];
      return [];
    });
  }

  private rangeOf(stretch: StretchInput, durationSec: number): CutRange {
    return { startSec: stretch.startSec, endSec: Math.min(stretch.endSec, durationSec) };
  }

  /** The cuts `cuts` becomes once `restored` is brought back and `removed` is cut. */
  private planned(cuts: CutRegistry, restored: ReadonlyArray<CutRange>, removed: ReadonlyArray<CutRange>): CutRegistry {
    const afterRestore = restored.reduce((registry, range) => registry.subtract(range), cuts);
    return removed.reduce((registry, range) => registry.add(range), afterRestore);
  }

  /**
   * The pauses `preset` finds between the words, leaving out those
   * already inside a cut, made safe with the sound when it can be read.
   */
  private newSilences(preset: RemoveSilencesPreset, durationSec: number, levels: AudioLevels | null): TrimmedSilences {
    const state = this.store.snapshot();
    const document = this.originalCaptions.read(state).document;
    const found = document === null ? [] : this.silenceFinder.findForPreset(document, durationSec, preset)
      .filter((silence) => !state.cuts.containsTimeRange(silence.range.startSec, silence.range.endSec));
    return levels === null
      ? { silences: found, trimmed: 0, withExtraMargin: 0, skipped: 0, heldBySound: 0 }
      : this.trimmer.trim(found, levels, durationSec, CUT_PACES[preset]);
  }

  private answered(durationSec: number, pauses: TrimmedSilences | null, words: WordCutsDone | null): OperationResult {
    const cuts = this.store.snapshot().cuts;
    const removedSec = cuts.list().reduce((total, range) => total + Math.max(0, Math.min(range.endSec, durationSec) - range.startSec), 0);
    return {
      ok: true,
      output: {
        cuts: cuts.list().map((range) => [this.rounded(range.startSec), this.rounded(range.endSec)]),
        removedSec: this.rounded(removedSec),
        remainingSec: this.rounded(durationSec - removedSec),
        ...(words === null ? {} : {
          words: {
            cut: words.cut,
            madeSmallerBySound: words.madeSmallerBySound,
            cutWithWiderMargin: words.cutWithWiderMargin,
            left: words.left.length,
            keptAsAir: words.keptAsAir.length,
          },
        }),
        ...(pauses === null ? {} : {
          pauses: {
            cut: pauses.silences.length,
            madeSmallerBySound: pauses.trimmed,
            cutWithWiderMargin: pauses.withExtraMargin,
            left: pauses.skipped,
            leftWithSound: pauses.heldBySound,
          },
        }),
      },
      problems: [],
    };
  }

  private rounded(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private problem(message: string): OperationProblem {
    return { severity: 'error', message };
  }

  private refusedFor(message: string): OperationResult {
    return this.refused([this.problem(message)]);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
