import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

/** What a press on the frame does while marking: drop a comment, or draw by hand. */
export type ReviewTool = 'comment' | 'pen';

/** A note being written: where its bubble hangs, what it marks, and what is said so far. */
export interface ReviewComposition {
  /** The moment, in seconds of the source video. */
  readonly sourceSec: number;
  readonly at: ReviewPoint;
  readonly marks: ReadonlyArray<ReviewMark>;
  readonly refs: ReadonlyArray<ReviewNoteRef>;
  readonly quote: string | null;
  readonly text: string;
}

/** The frame's marking mode as the editor shows it. */
export interface ReviewMarkingSnapshot {
  readonly active: boolean;
  /** Whether the tools are offered over the frame for one to be picked, before marking starts. */
  readonly choosing: boolean;
  readonly tool: ReviewTool;
  /** The mark under the pointer now, if one is being drawn. */
  readonly drawing: ReviewMark | null;
  /** The note being written, once something was picked or drawn. */
  readonly composition: ReviewComposition | null;
  /** The saved note whose bubble is open, if any. */
  readonly openNoteId: string | null;
}

const IDLE: ReviewMarkingSnapshot = { active: false, choosing: false, tool: 'comment', drawing: null, composition: null, openNoteId: null };

/**
 * Whether the frame is being marked, with which tool, or its tools are
 * offered for one to be picked, the mark being
 * drawn, the note being written, and which saved note's bubble is open.
 * Nothing here is a note until it is added; leaving the mode drops it.
 * Nothing outlives the editor's mount. Subscribers listen for `'change'`.
 */
export class ReviewMarkingStore extends EventTarget {
  private state: ReviewMarkingSnapshot = IDLE;

  snapshot(): ReviewMarkingSnapshot {
    return this.state;
  }

  /** Offers the tools over the frame, with none picked; marking starts once one is (`selectTool`). */
  offerTools(): void {
    if (this.state.active || this.state.choosing) return;
    this.set({ ...this.state, choosing: true, openNoteId: null });
  }

  /** Marks with `tool`, keeping what was drawn or written so far. */
  selectTool(tool: ReviewTool): void {
    if (this.state.active && tool === this.state.tool) return;
    this.set({ ...this.state, active: true, choosing: false, tool, openNoteId: null });
  }

  /** Leaves the mode, or puts the offered tools away, dropping whatever was drawn or written and not added. */
  stop(): void {
    if (!this.state.active && !this.state.choosing && this.state.openNoteId === null) return;
    this.set({ ...IDLE, tool: this.state.tool });
  }

  /** Starts a mark at `point` with the current tool; a comment needs no drawing. */
  beginMark(point: ReviewPoint): void {
    if (!this.state.active || this.state.tool === 'comment') return;
    const drawing: ReviewMark = { kind: 'stroke', points: [point] };
    this.set({ ...this.state, drawing, openNoteId: null });
  }

  extendMark(point: ReviewPoint): void {
    const { drawing } = this.state;
    if (drawing === null) return;
    const extended: ReviewMark = { kind: 'stroke', points: [...drawing.points, point] };
    this.set({ ...this.state, drawing: extended });
  }

  /** Ends the mark being drawn and answers it, or null when there was none. */
  endMark(): ReviewMark | null {
    const { drawing } = this.state;
    if (drawing === null) return null;
    this.set({ ...this.state, drawing: null });
    return drawing;
  }

  /** The marks already drawn for the note being written, before the next one. */
  pendingMarks(): ReadonlyArray<ReviewMark> {
    return this.state.composition?.marks ?? [];
  }

  /** Opens the bubble of a note being written, keeping any text written so far. */
  compose(composition: Omit<ReviewComposition, 'text'>): void {
    const text = this.state.composition?.text ?? '';
    this.set({ ...this.state, composition: { ...composition, text }, openNoteId: null });
  }

  setText(text: string): void {
    const { composition } = this.state;
    if (composition === null) return;
    this.set({ ...this.state, composition: { ...composition, text } });
  }

  /** Drops the note being written and what was drawn for it, staying in the mode. */
  discardComposition(): void {
    if (this.state.composition === null && this.state.drawing === null) return;
    this.set({ ...this.state, composition: null, drawing: null });
  }

  openNote(id: string): void {
    this.set({ ...this.state, openNoteId: id, choosing: false, composition: null, drawing: null });
  }

  closeNote(): void {
    if (this.state.openNoteId === null) return;
    this.set({ ...this.state, openNoteId: null });
  }

  private set(next: ReviewMarkingSnapshot): void {
    this.state = next;
    this.dispatchEvent(new Event('change'));
  }
}
