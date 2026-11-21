import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import { REVIEW_NOTE_REF_KINDS, type ReviewNoteRef, type ReviewNoteRefKind } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewNoteStatus } from '@core/review-notes/domain/ReviewNoteStatus';
import type { ReviewPlace } from '@core/review-notes/domain/ReviewPlace';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';

type Fields = Record<string, unknown>;

const STATUSES: ReadonlySet<string> = new Set<ReviewNoteStatus>(['draft', 'sent']);
const REF_KINDS: ReadonlySet<string> = new Set(REVIEW_NOTE_REF_KINDS);

/**
 * Reads stored notes back, trusting nothing about their shape: a note
 * that cannot be read whole is left out, and the others are kept. Within
 * a note, a ref of an unknown kind or a mark that cannot be drawn is
 * dropped, since the note holds without it.
 */
export class ReviewNoteSnapshotReader {
  read(value: unknown): ReadonlyArray<ReviewNote> {
    if (!Array.isArray(value)) return [];
    const notes: ReviewNote[] = [];
    const ids = new Set<string>();
    for (const item of value) {
      const note = this.noteOf(item);
      if (note === null || ids.has(note.id)) continue;
      ids.add(note.id);
      notes.push(note);
    }
    return notes;
  }

  private noteOf(value: unknown): ReviewNote | null {
    if (!this.isFields(value)) return null;
    const { id, number, createdAt, sourceSec, text, status } = value;
    if (typeof id !== 'string' || id === '') return null;
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return null;
    if (typeof sourceSec !== 'number' || !Number.isFinite(sourceSec) || sourceSec < 0) return null;
    if (typeof text !== 'string' || typeof status !== 'string' || !STATUSES.has(status)) return null;
    const created = typeof createdAt === 'string' ? new Date(createdAt) : null;
    if (created === null || Number.isNaN(created.getTime())) return null;
    const place = value['place'] === null || value['place'] === undefined ? null : this.placeOf(value['place']);
    if (place === undefined) return null;
    return {
      id,
      number,
      createdAt: created,
      sourceSec,
      place,
      refs: this.refsOf(value['refs']),
      quote: this.optionalText(value['quote']),
      text,
      status: status as ReviewNoteStatus,
      batchId: status === 'draft' ? null : this.optionalText(value['batchId']),
    };
  }

  /** The place, or undefined when one was stored and cannot be read. */
  private placeOf(value: unknown): ReviewPlace | undefined {
    if (!this.isFields(value)) return undefined;
    const at = this.pointOf(value['at']);
    const frameAspect = value['frameAspect'];
    if (at === null || typeof frameAspect !== 'number' || !Number.isFinite(frameAspect) || frameAspect <= 0) return undefined;
    const marks = Array.isArray(value['marks']) ? value['marks'].flatMap((mark: unknown) => {
      const read = this.markOf(mark);
      return read === null ? [] : [read];
    }) : [];
    return { at, frameAspect, marks };
  }

  private markOf(value: unknown): ReviewMark | null {
    if (!this.isFields(value)) return null;
    if (value['kind'] === 'stroke' && Array.isArray(value['points'])) {
      const points = value['points'].map((point: unknown) => this.pointOf(point));
      if (points.length === 0 || points.some((point) => point === null)) return null;
      return { kind: 'stroke', points: points as ReviewPoint[] };
    }
    return null;
  }

  private pointOf(value: unknown): ReviewPoint | null {
    if (!this.isFields(value)) return null;
    const { x, y } = value;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private refsOf(value: unknown): ReadonlyArray<ReviewNoteRef> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((ref: unknown) => {
      if (!this.isFields(ref)) return [];
      const { kind, id } = ref;
      if (typeof kind !== 'string' || !REF_KINDS.has(kind) || typeof id !== 'string' || id === '') return [];
      return [{ kind: kind as ReviewNoteRefKind, id }];
    });
  }

  private optionalText(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private isFields(value: unknown): value is Fields {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
