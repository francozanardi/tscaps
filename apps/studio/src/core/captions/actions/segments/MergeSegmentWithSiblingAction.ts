import { Document, Segment } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { CharOwnership } from '@core/captions/domain/CharOwnership';
import { SegmentRecompiler, type NeighborWindow } from '@core/captions/services/SegmentRecompiler';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';

/**
 * `Backspace` at the start of a scene merges it with the previous visible one;
 * `Delete` at the end merges with the next visible one. Cross-section merges are
 * allowed — the predecessor's section kind wins.
 */
export class MergeSegmentWithSiblingAction {
  private readonly recompiler = new SegmentRecompiler();

  constructor(
    private readonly store: EditorStore,
    private readonly deriver: DocumentDeriver,
    private readonly videoDurationProvider: () => number,
    private readonly cutAwareDocumentBuilder: CutAwareDocumentBuilder = new CutAwareDocumentBuilder(),
  ) {}

  execute(args: {
    segmentId: string;
    text: string;
    ownership: CharOwnership;
    direction: 'prev' | 'next';
  }): void {
    const snap = this.store.snapshot();
    const document = snap.document;
    const sheets = snap.sheets;
    if (!document || sheets.length === 0) return;

    const visibleDoc = this.cutAwareDocumentBuilder.build(document, snap.cuts);
    const visibleSegments = visibleDoc.getSegments();
    const vIdx = visibleSegments.findIndex((s) => s.id === args.segmentId);
    if (vIdx < 0) return;

    const partnerVisible = args.direction === 'prev'
      ? visibleSegments[vIdx - 1]
      : visibleSegments[vIdx + 1];
    if (!partnerVisible) return;

    const flat = document.getSegments();
    const idx = flat.findIndex((s) => s.id === args.segmentId);
    const partnerIdx = flat.findIndex((s) => s.id === partnerVisible.id);
    if (idx < 0 || partnerIdx < 0) return;

    const current = flat[idx]!;
    const recompiled = this.recompiler.recompile({
      segment: current,
      finalText: args.text,
      finalOwnership: args.ownership,
      pace: document.narrationPace,
      neighbors: this._neighborWindow(flat, idx),
    });

    const isCurrentLead = idx < partnerIdx;
    const leadId = isCurrentLead ? current.id : partnerVisible.id;
    const followerId = isCurrentLead ? partnerVisible.id : current.id;
    const leadSegment = isCurrentLead ? recompiled : flat[partnerIdx]!;
    const followerSegment = isCurrentLead ? flat[partnerIdx]! : recompiled;

    const mergedDoc = this._mergeSegments(document, leadId, followerId, leadSegment, followerSegment);
    const retagged = this.deriver.retag(mergedDoc);
    const withEffects = this.deriver.reapplyEffects(retagged, sheets, snap.video.duration, snap.decorationOverrides);

    // Freeze the merged segment so a subsequent reflow doesn't undo it.
    const frozenSegments = snap.frozenSegments.withStructurallyEdited([leadId]);

    this.store.commit();
    this.store.patch({ document: withEffects, frozenSegments });
  }

  private _mergeSegments(
    document: Document,
    leadId: string,
    followerId: string,
    leadSegment: Segment,
    followerSegment: Segment,
  ): Document {
    const merged = new Segment({
      lines: [...leadSegment.lines, ...followerSegment.lines],
      structureTags: leadSegment.structureTags,
      id: leadSegment.id,
    });
    const sections = document.sections.map((section) => {
      const hasLead = section.segments.some((s) => s.id === leadId);
      const hasFollower = section.segments.some((s) => s.id === followerId);
      if (!hasLead && !hasFollower) return section;

      let segs = section.segments;
      if (hasLead) {
        segs = segs.map((s) => (s.id === leadId ? merged : s));
      }
      if (hasFollower) {
        segs = segs.filter((s) => s.id !== followerId);
      }
      return section.with({ segments: segs });
    });
    return document.with({ sections });
  }

  private _neighborWindow(flat: ReadonlyArray<Segment>, flatIdx: number): NeighborWindow {
    const prev = flat[flatIdx - 1];
    const next = flat[flatIdx + 1];
    return {
      prevEnd: prev ? prev.time.end : 0,
      nextStart: next ? next.time.start : this.videoDurationProvider(),
    };
  }

}
