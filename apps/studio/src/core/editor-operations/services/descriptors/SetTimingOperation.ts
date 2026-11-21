import { z } from 'zod';
import type { Document, Segment } from '@tscaps/engine';
import type { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import type { EditWordTimeAction } from '@core/captions/actions/words/EditWordTimeAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

const MAX_ENTRIES = 200;
// Writes run until every entry lands or a pass moves nothing: a word is held
// by where its neighbours are now, so shifting a run of words lands only once
// the words it would pass have moved too. Passes alternate direction, which
// settles a run moved either way within two.
const MAX_PASSES = 4;
const SAME_TIME_SEC = 0.001;

/** One entry of the input, pointed at the word or the scene it times. */
interface TimingEntry {
  readonly kind: 'word' | 'segment';
  readonly ref: string;
  readonly id: string;
  readonly startSec: number;
  readonly endSec: number;
}

/** A start and an end, in seconds of the source video. */
interface Span {
  readonly startSec: number;
  readonly endSec: number;
}

const timeFields = {
  startSec: z.number().min(0).describe('Start, in seconds of the source video.'),
  endSec: z.number().min(0).describe('End, after startSec.'),
};

/**
 * `set_timing`: sets when words start and end and when scenes show, in
 * one call, through the actions the timeline's drags call. Every entry is
 * checked before anything is written. The actions hold a time at the
 * limits they keep (a word's neighbours, the scenes beside a scene on its
 * sheet, the video's ends); a time held short of what was asked is
 * answered as a warning, beside every entry's time as it now is.
 */
export class SetTimingOperation implements EditorOperation {
  readonly name = 'set_timing';
  readonly effect = 'edit';
  readonly description = [
    `Set when words and/or scenes (segments) start and end, up to ${MAX_ENTRIES} of each; nothing is changed when any entry is bad.`,
    'A word may overlap the words beside it but never pass them: to shift several words, name them all in one call.',
    'Moving a scene\'s first or last word outside a window set on it grows the window; a scene with no window set follows its words.',
    'A scene\'s window is when it shows: setting one stops automatic padding of it and keeps its layout, but its words stay where they are, and words outside it are spoken but not shown, so time them too.',
    'Scenes of one sheet never overlap (other sheets may), and nothing leaves the video: times are held at those limits, with a warning.',
    'Answers their times now; refs do not change.',
  ].join(' ');

  private readonly input = new OperationInput({
    words: z.array(z.strictObject({
      word: z.string().describe('The word, as a ref: word:<id>.'),
      ...timeFields,
    })).max(MAX_ENTRIES).optional(),
    scenes: z.array(z.strictObject({
      segment: z.string().describe('The scene, as a ref: segment:<id>.'),
      ...timeFields,
    })).max(MAX_ENTRIES).optional(),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly store: EditorStore,
    private readonly editWordTime: EditWordTimeAction,
    private readonly editSegmentTime: EditSegmentTimeAction,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const words = checked.value.words ?? [];
    const scenes = checked.value.scenes ?? [];
    if (words.length === 0 && scenes.length === 0) {
      return this.refused([{ severity: 'error', message: 'Give words, scenes or both.' }]);
    }
    const resolved = [
      ...words.map((each) => this.resolved('word', each.word, each)),
      ...scenes.map((each) => this.resolved('segment', each.segment, each)),
    ];
    const entries = resolved.flatMap((each) => (each.ok ? [each.value] : []));
    const problems = [...resolved.flatMap((each) => (each.ok ? [] : [each.problem])), ...this.namedTwice(entries)];
    if (problems.length > 0) return this.refused(problems);

    this.settle(entries);
    const now = entries.map((entry) => ({ entry, span: this.spanOf(entry) }));
    return {
      ok: true,
      output: {
        words: now.filter(({ entry }) => entry.kind === 'word').map(({ entry, span }) => ({ word: entry.ref, ...this.rounded(span) })),
        scenes: now.filter(({ entry }) => entry.kind === 'segment').map(({ entry, span }) => ({ segment: entry.ref, ...this.rounded(span) })),
      },
      problems: [...this.heldWarnings(entries), ...this.unshownSpeech(entries)],
    };
  }

  private resolved(kind: 'word' | 'segment', ref: string, span: Span): ResolvedRef<TimingEntry> {
    const element = this.captions.resolve(ref, [kind]);
    if (!element.ok) return element;
    if (span.endSec <= span.startSec) return this.problem(ref, `${ref} ends at or before it starts; endSec must be after startSec.`);
    const durationSec = this.store.snapshot().video.duration;
    if (durationSec > 0 && span.endSec > durationSec) {
      return this.problem(ref, `${ref} would end at ${span.endSec} s, past the video's end at ${this.format.sec(durationSec)} s.`);
    }
    return { ok: true, value: { kind, ref: element.value.ref, id: element.value.id, startSec: span.startSec, endSec: span.endSec } };
  }

  private namedTwice(entries: ReadonlyArray<TimingEntry>): OperationProblem[] {
    const seen = new Set<string>();
    const problems: OperationProblem[] = [];
    for (const entry of entries) {
      const key = `${entry.kind}:${entry.id}`;
      if (seen.has(key)) problems.push({ severity: 'error', ref: entry.ref, message: `${entry.ref} is named twice; give it one entry.` });
      seen.add(key);
    }
    return problems;
  }

  /**
   * Writes every entry not yet at its time, words before scenes so a
   * window named in the call wins over the growth an edge word causes,
   * pass after pass until all land or a pass moves nothing.
   */
  private settle(entries: ReadonlyArray<TimingEntry>): void {
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const pending = entries.filter((entry) => !this.landed(entry));
      if (pending.length === 0) return;
      const direction = pass % 2 === 0 ? 1 : -1;
      const ordered = [...pending].sort((a, b) => (a.kind === b.kind ? direction * (a.startSec - b.startSec) : a.kind === 'word' ? -1 : 1));
      let moved = false;
      for (const entry of ordered) moved = this.written(entry) || moved;
      if (!moved) return;
    }
  }

  /** Writes `entry`'s time. Whether that changed the word's or the scene's. */
  private written(entry: TimingEntry): boolean {
    const before = this.spanOf(entry);
    if (entry.kind === 'word') this.editWordTime.execute(entry.id, entry.startSec, entry.endSec);
    else this.editSegmentTime.execute({ segmentId: entry.id, start: entry.startSec, end: entry.endSec });
    const after = this.spanOf(entry);
    return before === null || after === null || !this.same(before, after);
  }

  /** Whether the entry's word or scene is at the time asked; a scene only once a window is set on it. */
  private landed(entry: TimingEntry): boolean {
    const span = entry.kind === 'segment' ? this.windowSetOn(entry.id) : this.spanOf(entry);
    return span !== null && this.same(span, entry);
  }

  private heldWarnings(entries: ReadonlyArray<TimingEntry>): OperationProblem[] {
    const held = entries.filter((entry) => !this.landed(entry));
    const describe = (kind: 'word' | 'segment'): string => held
      .filter((entry) => entry.kind === kind)
      .map((entry) => `${entry.ref} ${this.spanText(this.spanOf(entry))}`)
      .join(', ');
    const problems: OperationProblem[] = [];
    const words = describe('word');
    if (words !== '') {
      problems.push({ severity: 'warning', message: `Held short of the time asked, by the words beside them, a scene beside theirs on its sheet or the video's ends: ${words}. Move what holds them in the same call.` });
    }
    const scenes = describe('segment');
    if (scenes !== '') {
      problems.push({ severity: 'warning', message: `Held short of the time asked, by a scene beside them on their sheet or the video's ends: ${scenes}. Move or shorten that scene in the same call.` });
    }
    return problems;
  }

  /** A warning for each scene named, or holding a word named, whose words run outside when it shows. */
  private unshownSpeech(entries: ReadonlyArray<TimingEntry>): OperationProblem[] {
    const document = this.store.snapshot().document;
    if (document === null) return [];
    const ids = new Set(entries.map((entry) => entry.id));
    return document.getSegments()
      .filter((segment) => ids.has(segment.id) || segment.getWords().some((word) => ids.has(word.id)))
      .flatMap((segment) => {
        const spoken = segment.getWords().filter((word) => word.text.length > 0);
        const outside = spoken.filter((word) => word.time.start < segment.time.start - SAME_TIME_SEC || word.time.end > segment.time.end + SAME_TIME_SEC);
        if (outside.length === 0) return [];
        const shown = { startSec: segment.time.start, endSec: segment.time.end };
        return [{
          severity: 'warning' as const,
          ref: `segment:${segment.id}`,
          message: `segment:${segment.id} shows ${this.spanText(shown)}, so ${outside.map((word) => `word:${word.id}`).join(', ')} ${outside.length === 1 ? 'is' : 'are'} spoken but not shown.`,
        }];
      });
  }

  private spanOf(entry: TimingEntry): Span | null {
    const document = this.store.snapshot().document;
    if (document === null) return null;
    if (entry.kind === 'segment') {
      const segment = this.segmentNamed(document, entry.id);
      return segment === null ? null : { startSec: segment.time.start, endSec: segment.time.end };
    }
    const word = document.getWords().find((each) => each.id === entry.id);
    return word === undefined ? null : { startSec: word.time.start, endSec: word.time.end };
  }

  private windowSetOn(segmentId: string): Span | null {
    const document = this.store.snapshot().document;
    const window = document === null ? null : this.segmentNamed(document, segmentId)?.customTime ?? null;
    return window === null ? null : { startSec: window.start, endSec: window.end };
  }

  private segmentNamed(document: Document, segmentId: string): Segment | null {
    return document.getSegments().find((segment) => segment.id === segmentId) ?? null;
  }

  private same(a: Span, b: Span): boolean {
    return Math.abs(a.startSec - b.startSec) < SAME_TIME_SEC && Math.abs(a.endSec - b.endSec) < SAME_TIME_SEC;
  }

  private rounded(span: Span | null): Span | Record<string, never> {
    return span === null ? {} : { startSec: this.format.sec(span.startSec), endSec: this.format.sec(span.endSec) };
  }

  private spanText(span: Span | null): string {
    return span === null ? '(gone)' : `${this.format.sec(span.startSec)}–${this.format.sec(span.endSec)} s`;
  }

  private problem(ref: string, message: string): ResolvedRef<TimingEntry> {
    return { ok: false, problem: { severity: 'error', message, ref } };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
