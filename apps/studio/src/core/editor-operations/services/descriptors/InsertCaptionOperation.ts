import { z } from 'zod';
import type { Document, Segment } from '@tscaps/engine';
import type { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import type { InsertSegmentAction } from '@core/captions/actions/segments/InsertSegmentAction';
import type { RedistributeSegmentWordsAction } from '@core/captions/actions/segments/RedistributeSegmentWordsAction';
import type { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import type { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import type { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

const MAX_TEXT_CHARS = 300;

/** The scene a new one goes beside, and on which side; no anchor for the first scene of a video with none. */
interface Placement {
  readonly anchor: { readonly id: string; readonly ref: string } | null;
  readonly position: 'before' | 'after';
}

/** A start and an end, in seconds of the source video. */
interface Span {
  readonly startSec: number;
  readonly endSec: number;
}

/**
 * `insert_caption`: adds a scene with its own text where nothing is
 * said, as the transcript's "add scene" and typing into it do: the scene
 * is inserted beside another on that one's sheet, given the window
 * asked, and its words share the window by speaking pace. A window
 * reaching into a scene of the same sheet, which the editor would cut
 * short, is refused with the free time there is.
 */
export class InsertCaptionOperation implements EditorOperation {
  readonly name = 'insert_caption';
  readonly effect = 'edit';
  readonly description = [
    'Add a caption (scene) with its own text: right after or before a scene, on that scene\'s sheet, or as the first caption of a video that has none (give neither).',
    'Its time must lie in the free time between that scene and the next one on its sheet, inside the video; it shows exactly then and keeps its layout, and its words share it by speaking pace.',
    'Answers the new scene\'s ref and its words\' refs.',
  ].join(' ');

  private readonly input = new OperationInput({
    text: z.string().max(MAX_TEXT_CHARS).describe('What it says; spaces separate words.'),
    startSec: z.number().min(0).describe('When it appears, in seconds of the source video.'),
    endSec: z.number().min(0).describe('When it goes, after startSec.'),
    after: z.string().optional().describe('The scene it follows, as a ref: segment:<id>.'),
    before: z.string().optional().describe('The scene it comes before, as a ref: segment:<id>. Not with after.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly captions: CaptionRefResolver,
    private readonly hardTime: SegmentHardTime,
    private readonly segmentBounds: SegmentTimeBounds,
    private readonly insertSegment: InsertSegmentAction,
    private readonly editSegmentTime: EditSegmentTimeAction,
    private readonly editWordText: EditWordTextAction,
    private readonly redistributeWords: RedistributeSegmentWordsAction,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { text, startSec, endSec, after, before } = checked.value;
    const document = this.store.snapshot().document;
    if (document === null) return this.refusedWith('The project has no captions yet; it needs a video first.');
    if (text.trim() === '') return this.refusedWith('The text is empty; a caption needs something to say.');
    const span = { startSec, endSec };
    const timeProblem = this.timeProblem(span);
    if (timeProblem !== null) return this.refusedWith(timeProblem);
    const placement = this.placement(document, after, before);
    if (!placement.ok) return this.refused([placement.problem]);
    const roomProblem = this.roomProblem(document, placement.value, span);
    if (roomProblem !== null) return this.refused([roomProblem]);

    const wordId = this.insertSegment.execute(placement.value.anchor?.id ?? null, placement.value.position);
    const segmentId = wordId === '' ? null : this.segmentHolding(wordId);
    if (segmentId === null) {
      return this.refusedWith(`The editor found no room ${placement.value.position} ${placement.value.anchor?.ref ?? 'the video\'s start'}: the video there may be cut.`);
    }
    // Text first: replacing a scene's words clears a window set on it.
    this.editWordText.execute(wordId, text);
    this.editSegmentTime.execute({ segmentId, start: startSec, end: endSec });
    this.redistributeWords.execute(segmentId);
    return { ok: true, output: { caption: this.parser.formatOf('segment', segmentId), words: this.wordRefsOf(segmentId) }, problems: [] };
  }

  private timeProblem(span: Span): string | null {
    if (span.endSec <= span.startSec) return 'endSec must be after startSec.';
    const durationSec = this.store.snapshot().video.duration;
    if (durationSec > 0 && span.endSec > durationSec) return `endSec is past the video's end at ${this.format.sec(durationSec)} s.`;
    return null;
  }

  private placement(document: Document, after: string | undefined, before: string | undefined): ResolvedRef<Placement> {
    if (after !== undefined && before !== undefined) return this.problem('Give after or before, not both.');
    const ref = after ?? before;
    const position = after !== undefined ? 'after' : 'before';
    if (ref === undefined) {
      if (document.getSegments().length > 0) return this.problem('The video has captions: name the scene the new one goes after or before.');
      return { ok: true, value: { anchor: null, position } };
    }
    const anchor = this.captions.resolve(ref, ['segment']);
    if (!anchor.ok) return anchor;
    return { ok: true, value: { anchor: { id: anchor.value.id, ref: anchor.value.ref }, position } };
  }

  /** Why `span` does not fit the free time beside the anchor on its sheet, or null when it does. */
  private roomProblem(document: Document, placement: Placement, span: Span): OperationProblem | null {
    if (placement.anchor === null) return null;
    const anchor = document.getSegments().find((segment) => segment.id === placement.anchor?.id);
    if (anchor === undefined) return null;
    const room = this.roomBeside(document, anchor, placement.position);
    if (span.startSec >= room.startSec && span.endSec <= room.endSec) return null;
    const until = Number.isFinite(room.endSec) ? `${this.format.sec(room.endSec)} s` : 'the end';
    return {
      severity: 'error',
      ref: placement.anchor.ref,
      message: `The free time ${placement.position} ${placement.anchor.ref} on its sheet runs ${this.format.sec(room.startSec)} s to ${until}; put the caption inside it, or make room with set_timing first.`,
    };
  }

  /** The time between `anchor` and the scene beside it on its sheet, on the side named, inside the video. */
  private roomBeside(document: Document, anchor: Segment, position: 'before' | 'after'): Span {
    const limits = this.segmentBounds.limitsFor(document, anchor.id, this.store.snapshot().video.duration);
    const own = this.hardTime.of(anchor) ?? anchor.time;
    return position === 'after'
      ? { startSec: own.end, endSec: limits.latestEndSec }
      : { startSec: limits.earliestStartSec, endSec: own.start };
  }

  private segmentHolding(wordId: string): string | null {
    const segments = this.store.snapshot().document?.getSegments() ?? [];
    return segments.find((segment) => segment.getWords().some((word) => word.id === wordId))?.id ?? null;
  }

  private wordRefsOf(segmentId: string): string[] {
    const segment = this.store.snapshot().document?.getSegments().find((each) => each.id === segmentId);
    return (segment?.getWords() ?? []).map((word) => this.parser.formatOf('word', word.id));
  }

  private problem(message: string): ResolvedRef<Placement> {
    return { ok: false, problem: { severity: 'error', message } };
  }

  private refusedWith(message: string): OperationResult {
    return this.refused([{ severity: 'error', message }]);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
