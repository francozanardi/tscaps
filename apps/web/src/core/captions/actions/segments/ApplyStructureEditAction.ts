import type { Document, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';

/**
 * Applies a structural edit (split/merge line or segment, move words across
 * boundaries) to the current document, retags it, and freezes every segment
 * whose word composition differs from the pre-edit document so subsequent
 * style edits don't undo the manual layout the user just produced.
 */
export class ApplyStructureEditAction {
  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
  ) {}

  execute(editedDoc: Document): void {
    const snap = this.store.snapshot();
    const { sheets, document: prevDoc } = snap;
    if (sheets.length === 0) return;

    const retagged = this.deriver.retag(editedDoc);
    const document = this.deriver.reapplyEffects(retagged, sheets, snap.video.duration, snap.decorationOverrides);
    const newlyShapedIds = prevDoc ? this._newlyShapedSegmentIds(prevDoc, document) : new Set<string>();

    this.store.commit();
    this.store.patch({ document, segmentOverrides: snap.segmentOverrides.withFreezeMany(newlyShapedIds) });
  }

  /**
   * Segment ids in `next` whose line-and-word fingerprint either didn't
   * exist in `prev` or differs from the segment in `prev` with the same
   * id. The fingerprint preserves line boundaries so a line break /
   * line join inside one segment counts as shape change even when the
   * word membership is identical.
   */
  private _newlyShapedSegmentIds(prev: Document, next: Document): Set<string> {
    const prevByid = new Map<string, string>();
    for (const seg of prev.getSegments()) {
      prevByid.set(seg.id, this._fingerprint(seg));
    }
    const out = new Set<string>();
    for (const seg of next.getSegments()) {
      const prevSeq = prevByid.get(seg.id);
      const nextSeq = this._fingerprint(seg);
      if (prevSeq === undefined || prevSeq !== nextSeq) out.add(seg.id);
    }
    return out;
  }

  private _fingerprint(seg: Segment): string {
    return seg.lines.map((l) => l.words.map((w) => w.id).join('|')).join('\n');
  }
}
