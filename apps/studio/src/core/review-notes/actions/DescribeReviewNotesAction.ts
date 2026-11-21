import { RenderTimeMap } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ReviewFrameSet, ReviewFrames } from '@core/review-notes/domain/ReviewFrames';
import type { ReviewMarkPainter } from '@core/review-notes/domain/ReviewMarkPainter';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteFacts } from '@core/review-notes/domain/ReviewNoteFacts';
import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewNotePicture, ReviewNoteRefNaming, ReviewNotesReading } from '@core/review-notes/domain/ReviewNotesReading';
import type { ReviewNoteRefReader, ReviewNoteRefScope } from '@core/review-notes/services/ReviewNoteRefReader';
import type { ReviewNoteTextWriter } from '@core/review-notes/services/ReviewNoteTextWriter';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';

/** The pictures of the notes' places, and how they differ from the export. */
interface NotePictures {
  readonly pictures: ReadonlyArray<ReviewNotePicture>;
  readonly pictureNotes: ReadonlyArray<string>;
}

/** How far the frame's aspect can move before a note's place is said to point elsewhere. */
const ASPECT_TOLERANCE = 0.01;

/**
 * Turns notes into what a model reads: text that says what each note
 * asks, where and when, and what is under it now, and for each moment a
 * note marks a place at, the output frame as the export draws it, every
 * note of that moment painted over it. Never a picture of the preview.
 *
 * Refs are written as `refName` names them, `kind:id` when it is not
 * given. A moment that could not be drawn leaves its note without a
 * picture, and the text says so; it never fails the whole reading.
 */
export class DescribeReviewNotesAction {
  constructor(
    private readonly store: EditorStore,
    private readonly frames: ReviewFrames,
    private readonly painter: ReviewMarkPainter,
    private readonly refReader: ReviewNoteRefReader,
    private readonly textWriter: ReviewNoteTextWriter,
    private readonly shotsMaterializer: ShotPartitionMaterializer,
  ) {}

  async execute(notes: ReadonlyArray<ReviewNote>, signal: AbortSignal, refName?: ReviewNoteRefNaming): Promise<ReviewNotesReading> {
    const state = this.store.snapshot();
    const { pictures, pictureNotes } = await this.picturesOf(notes, signal);
    const pictured = new Set(pictures.flatMap((picture) => picture.numbers));
    const scope: ReviewNoteRefScope = { document: state.document, shots: this.shotsMaterializer.materializeFrom(state) };
    const timeMap = new RenderTimeMap(state.cuts.list());
    const aspect = this.aspectOf(state);
    const facts = notes.map((note): ReviewNoteFacts => ({
      note,
      outputSec: timeMap.isSkipped(note.sourceSec) ? null : timeMap.toOutputTime(note.sourceSec),
      refs: note.refs.map((ref) => ({ name: refName === undefined ? this.editorNameOf(ref) : refName(ref), reading: this.refReader.read(ref, scope) })),
      pictured: pictured.has(note.number),
      aspectChanged: note.place !== null && aspect !== null && Math.abs(note.place.frameAspect - aspect) > ASPECT_TOLERANCE,
    }));
    return { text: this.textWriter.write(facts, pictureNotes), pictures };
  }

  private async picturesOf(notes: ReadonlyArray<ReviewNote>, signal: AbortSignal): Promise<NotePictures> {
    const placed = notes.filter((note) => note.place !== null);
    if (placed.length === 0) return { pictures: [], pictureNotes: [] };
    const moments = [...new Set(placed.map((note) => note.sourceSec))].sort((a, b) => a - b);
    const rendered = await this.frames.renderAt(moments, signal);
    try {
      return { pictures: await this.paintedOver(rendered, moments, placed), pictureNotes: rendered.notes };
    } finally {
      for (const frame of rendered.frames) frame.bitmap.close();
    }
  }

  /** One picture per moment drawn, with every note at that moment painted on it. */
  private async paintedOver(
    rendered: ReviewFrameSet,
    moments: ReadonlyArray<number>,
    placed: ReadonlyArray<ReviewNote>,
  ): Promise<ReadonlyArray<ReviewNotePicture>> {
    const pictures: ReviewNotePicture[] = [];
    for (const sourceSec of moments) {
      const frame = rendered.frames.find((each) => each.sourceSec === sourceSec);
      if (frame === undefined) continue;
      const marked = placed.flatMap((note) => (note.sourceSec === sourceSec && note.place !== null ? [{ place: note.place, number: note.number }] : []));
      pictures.push({ sourceSec, numbers: marked.map((each) => each.number), bitmap: await this.painter.paint(frame.bitmap, marked) });
    }
    return pictures;
  }

  private aspectOf(state: EditorState): number | null {
    const layout = state.frameLayout;
    return layout === null || layout.height === 0 ? null : layout.width / layout.height;
  }

  private editorNameOf(ref: ReviewNoteRef): string {
    return `${ref.kind}:${ref.id}`;
  }
}
