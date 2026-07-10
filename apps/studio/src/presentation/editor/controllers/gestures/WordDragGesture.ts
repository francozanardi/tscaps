import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetWordStyleOverrideAction } from '@core/captions/actions/words/SetWordStyleOverrideAction';
import type { ClearWordAlignmentOverrideAction } from '@core/captions/actions/words/ClearWordAlignmentOverrideAction';
import type { SnapZoneResolver } from '@presentation/editor/services/SnapZoneResolver';
import type { DragGeometryResolver } from '@presentation/editor/services/DragGeometryResolver';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import type { SegmentBindingRegistry } from '@presentation/editor/controllers/SegmentBindingRegistry';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type WordBindInput,
  type WordDragState,
  type WordDragTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

// Extra px added to the segment hitzone's bounding rect on each side
// when testing whether the cursor is over the home segment during a
// word drag. Deliberately tighter than the visible chrome padding —
// the chrome extends well past the text for click-target reasons, but
// snapping back to flow on every release inside that wide rectangle
// would forbid positioning a word anywhere near its segment. Kept as
// a small forgiveness margin so the user doesn't have to land the
// cursor exactly on a glyph.
const SEGMENT_DROP_ZONE_INFLATE_PX = 4;

// Used in place of the tight inflation when the home segment has no
// inline words left to render — every other word in the segment is
// already detached, so the hitzone shrinks to the decoration's bbox
// (or to zero). The tight-inflation rationale ("don't snap when the
// user releases near the segment's text") doesn't apply: there is no
// text to be near. Values match the visible chrome `::before` inset
// (see `SubtitleOverlay.css`), so the snap zone covers the same
// rectangle the user sees highlighted.
const EMPTY_HOME_DROP_ZONE_INFLATE_X_PX = 32;
const EMPTY_HOME_DROP_ZONE_INFLATE_Y_PX = 22;

/**
 * Gesture: drag a word to a new position inside the video frame.
 * Commits a per-word position override (vertical/horizontal align +
 * offset). When the user releases inside the word's home segment the
 * gesture cancels — if the word was already detached, the override
 * is cleared (return-to-flow); if it was in-flow to begin with, the
 * drag is a no-op.
 *
 * Selection-first gating: an in-flow word only drags when it's the
 * current selection. The first press selects; a second press-drag
 * moves. Already-detached words skip the gate because they're
 * standalone anchors with no ambiguity against the segment hitzone.
 */
export class WordDragGesture {
  /** Captured at start so the commit branch can tell apart "the user
   *  moved a previously-detached word back home" (clear the override)
   *  from "the user nudged an in-flow word back inside its segment"
   *  (no edit). `false` between drags. */
  private startedDetached = false;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly segments: SegmentBindingRegistry,
    private readonly editorStore: EditorStore,
    private readonly setWordStyleOverride: SetWordStyleOverrideAction,
    private readonly clearWordAlignmentOverride: ClearWordAlignmentOverrideAction,
    private readonly snapResolver: SnapZoneResolver,
    private readonly geometryResolver: DragGeometryResolver,
    private readonly selectionController: OverlaySelectionController,
  ) {}

  bind(input: WordBindInput): () => void {
    const target: WordDragTarget = { kind: 'word', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.span.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.span.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: WordDragTarget, clientX: number, clientY: number): WordDragState {
    const { dx, dy } = session.delta(clientX, clientY);
    const centroid = this.geometryResolver.centroid(session.anchorRect, session.scalerRect, dx, dy);
    const resolution = this.snapResolver.resolveWord(centroid.centroidXFrac, centroid.centroidYFrac);
    return {
      kind: 'word',
      wordId: target.wordId,
      deltaX: dx,
      deltaY: dy,
      verticalOffset: resolution.verticalOffset,
      horizontalOffset: resolution.horizontalOffset,
      horizontalSnap: resolution.horizontalSnap,
      dropTargetSegmentId: this.resolveReturnToFlowSegmentId(target, clientX, clientY),
    };
  }

  applyMoveSideEffects(): void {
    // Word drag does NOT paint the span — applying any visual offset
    // to the in-place span would keep it inside the segment's filter
    // / clip region and the word would vanish as it exited. The
    // floating word is rendered by React (`PositionedWordLayer`)
    // reading the controller's drag state.
  }

  commit(state: WordDragState): void {
    if (state.dropTargetSegmentId !== null) {
      // Release inside the home segment is the cancel/return-to-flow
      // gesture: skip the position commit. Only call the clear action
      // when there is an override to remove — an in-flow word
      // reaching back home mid-gesture just unwinds with no edit.
      if (this.startedDetached) this.clearWordAlignmentOverride.execute(state.wordId);
      return;
    }
    const previous = this.editorStore.snapshot().wordStyleOverrides.get(state.wordId);
    // Anchor is pinned to `center` on both axes so a later sheet or
    // segment alignment change does not drag the detached word along
    // with it. Offsets become the position of the word's center.
    this.setWordStyleOverride.execute(state.wordId, {
      ...previous,
      verticalAlign: 'center',
      verticalOffset: state.verticalOffset,
      horizontalAlign: 'center',
      horizontalOffset: state.horizontalOffset,
    });
  }

  cleanupOnEnd(): void {
    this.startedDetached = false;
  }

  private tryStart(target: WordDragTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const detached = this.editorStore.snapshot().wordStyleOverrides.hasAlignmentOverride(target.wordId);
    // Selection-first gating only applies to in-flow words inside a
    // segment, where the press is visually ambiguous between "select
    // this word" and "grab the whole subtitle". Already-detached
    // words are standalone anchors with no such ambiguity, so they
    // drag from first touch. When the gate bails the event must keep
    // bubbling to the segment hitzone so a press-drag on a word
    // without any selection still moves the segment.
    if (!detached && !this.isWordSelected(target.wordId)) return;
    event.stopPropagation();
    this.startedDetached = detached;
    const session = new DragSession(
      target,
      target.span.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  private isWordSelected(wordId: string): boolean {
    const selection = this.selectionController.selectionSnapshot();
    return selection?.wordId === wordId;
  }

  private resolveReturnToFlowSegmentId(target: WordDragTarget, clientX: number, clientY: number): string | null {
    const home = this.segments.get(target.segmentId);
    if (!home) return null;
    const rect = home.hitzone.getBoundingClientRect();
    const tight = this.homeSegmentHasInlineWords(target.segmentId, target.wordId);
    const inflateX = tight ? SEGMENT_DROP_ZONE_INFLATE_PX : EMPTY_HOME_DROP_ZONE_INFLATE_X_PX;
    const inflateY = tight ? SEGMENT_DROP_ZONE_INFLATE_PX : EMPTY_HOME_DROP_ZONE_INFLATE_Y_PX;
    const inside = clientX >= rect.left - inflateX
                && clientX <= rect.right + inflateX
                && clientY >= rect.top - inflateY
                && clientY <= rect.bottom + inflateY;
    return inside ? target.segmentId : null;
  }

  private homeSegmentHasInlineWords(segmentId: string, draggedWordId: string): boolean {
    const snap = this.editorStore.snapshot();
    const document = snap.document;
    if (!document) return true;
    for (const segment of document.getSegments()) {
      if (segment.id !== segmentId) continue;
      for (const line of segment.lines) {
        for (const word of line.words) {
          if (word.id === draggedWordId) continue;
          if (!snap.wordStyleOverrides.hasAlignmentOverride(word.id)) return true;
        }
      }
      return false;
    }
    return true;
  }
}
