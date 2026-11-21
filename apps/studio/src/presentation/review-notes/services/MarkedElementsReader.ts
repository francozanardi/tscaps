import type { Document } from '@tscaps/engine';
import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewNoteRef, ReviewNoteRefKind } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';
import type { ReviewBox, ReviewMarkGeometry } from '@presentation/review-notes/services/ReviewMarkGeometry';

const SHOT_LAYER_ATTRIBUTE = 'data-tscaps-shot-layer-id';
/** How far outside an element a point still counts as on it, in shares of the frame. */
const REACH = 0.012;
/** More than this many and the list says less, not more. */
const MAX_REFS = 6;

interface MarkedCandidate {
  readonly ref: ReviewNoteRef;
  readonly box: ReviewBox;
}

/**
 * Reads what a note was made over from the preview's DOM: the caption
 * nodes (`data-tscaps-el`) and the boxes of the shots' layers drawn over
 * the frame, whose painted box holds the point picked, or sits inside
 * a line drawn around it. Innermost first, so a
 * word comes before its line and its segment.
 *
 * By geometry, not by asking the browser what is under a point: the
 * segment and line boxes take no pointer, and while marking, a layer
 * over the whole frame takes every press.
 */
export class MarkedElementsReader {
  constructor(private readonly geometry: ReviewMarkGeometry) {}

  /** `frame` is the output frame's box on screen; `root` holds everything drawn over it. */
  read(root: HTMLElement, frame: DOMRect, at: ReviewPoint, marks: ReadonlyArray<ReviewMark>, document: Document | null): ReadonlyArray<ReviewNoteRef> {
    const points = [at];
    const circled = marks.flatMap((mark) => (mark.points.length > 2 ? [this.geometry.boxOf(mark.points)] : []));
    const hits = this.candidatesIn(root, frame, document)
      .filter((candidate) => points.some((point) => this.holds(candidate.box, point, REACH))
        || circled.some((box) => this.holds(box, this.centreOf(candidate.box), 0)))
      .sort((a, b) => this.areaOf(a.box) - this.areaOf(b.box));
    const seen = new Set<string>();
    const refs: ReviewNoteRef[] = [];
    for (const { ref } of hits) {
      const key = `${ref.kind}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
    return refs.slice(0, MAX_REFS);
  }

  private candidatesIn(root: HTMLElement, frame: DOMRect, document: Document | null): ReadonlyArray<MarkedCandidate> {
    const kinds = this.captionKindsOf(document);
    const candidates: MarkedCandidate[] = [];
    for (const element of root.querySelectorAll<HTMLElement>(`[${CAPTION_ELEMENT_ID_ATTRIBUTE}], [${SHOT_LAYER_ATTRIBUTE}]`)) {
      const ref = this.refOf(element, kinds);
      const box = ref === null ? null : this.boxOf(element, frame);
      if (ref !== null && box !== null) candidates.push({ ref, box });
    }
    return candidates;
  }

  private refOf(element: HTMLElement, kinds: ReadonlyMap<string, ReviewNoteRefKind>): ReviewNoteRef | null {
    const layerId = element.getAttribute(SHOT_LAYER_ATTRIBUTE);
    if (layerId !== null) return { kind: 'layer', id: layerId };
    const id = element.getAttribute(CAPTION_ELEMENT_ID_ATTRIBUTE);
    const kind = id === null ? undefined : kinds.get(id);
    return id === null || kind === undefined ? null : { kind, id };
  }

  /** Every caption node's id with its kind, read from the captions themselves. */
  private captionKindsOf(document: Document | null): ReadonlyMap<string, ReviewNoteRefKind> {
    const kinds = new Map<string, ReviewNoteRefKind>();
    if (document === null) return kinds;
    for (const segment of document.getSegments()) kinds.set(segment.id, 'segment');
    for (const line of document.getLines()) kinds.set(line.id, 'line');
    for (const word of document.getWords()) {
      kinds.set(word.id, 'word');
      if (word.decoration !== null) kinds.set(word.decoration.id, 'decoration');
    }
    return kinds;
  }

  /** The element's painted box in shares of the frame, or null when it shows nothing. */
  private boxOf(element: HTMLElement, frame: DOMRect): ReviewBox | null {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || frame.width === 0 || frame.height === 0) return null;
    return {
      left: (rect.left - frame.left) / frame.width,
      top: (rect.top - frame.top) / frame.height,
      right: (rect.right - frame.left) / frame.width,
      bottom: (rect.bottom - frame.top) / frame.height,
    };
  }

  private holds(box: ReviewBox, point: ReviewPoint, reach: number): boolean {
    return point.x >= box.left - reach && point.x <= box.right + reach && point.y >= box.top - reach && point.y <= box.bottom + reach;
  }

  private centreOf(box: ReviewBox): ReviewPoint {
    return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
  }

  private areaOf(box: ReviewBox): number {
    return (box.right - box.left) * (box.bottom - box.top);
  }
}
