import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetWordStyleOverrideAction } from '@core/editor/actions/words/SetWordStyleOverrideAction';
import type { RotationGeometryResolver } from '@presentation/editor/services/RotationGeometryResolver';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type WordRotateBindInput,
  type WordRotateState,
  type WordRotateTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag the rotation icon on the selected word to rotate
 * that word's span around the centre of its glyph bounding box.
 * Commits a per-word `rotation` override on every pointermove; the
 * action's coalescing key collapses the per-tick stream into a
 * single undo entry. Per-word rotation is post-derivation so the
 * line-splitter never reruns mid-gesture.
 */
export class WordRotateGesture {
  /** Rotation override the word carried at pointerdown, used as the
   *  base the per-tick delta is added to. `null` between gestures. */
  private originalRotationDeg: number | null = null;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly editorStore: EditorStore,
    private readonly setWordStyleOverride: SetWordStyleOverrideAction,
    private readonly rotationGeometry: RotationGeometryResolver,
  ) {}

  bind(input: WordRotateBindInput): () => void {
    const target: WordRotateTarget = { kind: 'word-rotate', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: WordRotateTarget, clientX: number, clientY: number): WordRotateState {
    const original = this.originalRotationDeg ?? 0;
    const pivotX = session.anchorRect.left + session.anchorRect.width / 2;
    const pivotY = session.anchorRect.top + session.anchorRect.height / 2;
    const delta = this.rotationGeometry.deltaDegrees(
      pivotX, pivotY, session.startClientX, session.startClientY, clientX, clientY,
    );
    const snap = this.rotationGeometry.snap(original + delta);
    return {
      kind: 'word-rotate',
      wordId: target.wordId,
      rotationDeg: snap.value,
      snappedAngleDeg: snap.snappedTo,
    };
  }

  applyMoveSideEffects(_session: DragSession, state: WordRotateState): void {
    this.writeRotationOverride(state.wordId, state.rotationDeg);
  }

  commit(state: WordRotateState): void {
    this.writeRotationOverride(state.wordId, state.rotationDeg);
  }

  cleanupOnEnd(): void {
    this.originalRotationDeg = null;
  }

  private writeRotationOverride(wordId: string, rotationDeg: number): void {
    const previous = this.editorStore.snapshot().wordStyleOverrides.get(wordId);
    this.setWordStyleOverride.execute(wordId, { ...previous, rotation: rotationDeg });
  }

  private tryStart(target: WordRotateTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const span = this.findWordSpan(scaler, target.wordId);
    if (!span) return;
    event.stopPropagation();
    this.originalRotationDeg = this.readBaselineRotation(target.wordId);
    const session = new DragSession(
      target,
      span.getBoundingClientRect(),
      scaler.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      event.pointerId,
      DRAG_ACTIVATION_THRESHOLD_PX,
    );
    this.host.activateSession(session);
  }

  private findWordSpan(scaler: HTMLElement, wordId: string): HTMLElement | null {
    return scaler.querySelector<HTMLElement>(`[data-tscaps-word-id="${CSS.escape(wordId)}"]`);
  }

  /** Per-word rotation override when present (latched user choice),
   *  else `0` — the segment / sheet rotation already cascades into
   *  the word's screen-position, so the per-tick delta only needs
   *  to add the user's incremental twist on top. */
  private readBaselineRotation(wordId: string): number {
    return this.editorStore.snapshot().wordStyleOverrides.get(wordId).rotation ?? 0;
  }
}
