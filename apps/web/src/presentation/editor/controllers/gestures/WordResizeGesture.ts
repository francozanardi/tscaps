import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SetWordStyleOverrideAction } from '@core/captions/actions/words/SetWordStyleOverrideAction';
import type { ResizeGeometryResolver } from '@presentation/editor/services/ResizeGeometryResolver';
import type { FontSizeBounds } from '@presentation/editor/services/FontSizeBounds';
import { DragSession } from '@presentation/editor/controllers/DragSession';
import {
  DRAG_ACTIVATION_THRESHOLD_PX,
  type OverlayGestureHost,
  type WordResizeBindInput,
  type WordResizeState,
  type WordResizeTarget,
} from '@presentation/editor/controllers/OverlayManipulationTypes';

/**
 * Gesture: drag a corner handle on the selected word to scale its
 * per-word font-size override. Per-word font-size is
 * post-derivation, so commits do not trigger a line-splitter re-run
 * — the handle can fire on every pointermove without debouncing.
 * The set-word-override action coalesces per-tick writes into one
 * undo step via its commit key.
 */
export class WordResizeGesture {
  /** The original cqh-equivalent of the word's rendered font-size at
   *  pointerdown, used so per-move commits scale from the original
   *  value instead of compounding each tick. `null` between
   *  gestures. */
  private originalFontSize: number | null = null;

  constructor(
    private readonly host: OverlayGestureHost,
    private readonly editorStore: EditorStore,
    private readonly setWordStyleOverride: SetWordStyleOverrideAction,
    private readonly resizeGeometry: ResizeGeometryResolver,
    private readonly fontSizeBounds: FontSizeBounds,
  ) {}

  bind(input: WordResizeBindInput): () => void {
    const target: WordResizeTarget = { kind: 'word-resize', ...input };
    const onPointerDown = (event: PointerEvent): void => this.tryStart(target, event);
    target.handle.addEventListener('pointerdown', onPointerDown);
    return () => {
      target.handle.removeEventListener('pointerdown', onPointerDown);
    };
  }

  computeState(session: DragSession, target: WordResizeTarget, clientX: number, clientY: number): WordResizeState {
    const original = this.originalFontSize ?? 0;
    const { dx, dy } = session.delta(clientX, clientY);
    const scale = this.resizeGeometry.scale(session.anchorRect, target.corner, dx, dy);
    const fontSize = this.fontSizeBounds.clamp(original * scale);
    return { kind: 'word-resize', wordId: target.wordId, fontSize };
  }

  applyMoveSideEffects(_session: DragSession, state: WordResizeState): void {
    this.writeFontSizeOverride(state.wordId, state.fontSize);
  }

  commit(state: WordResizeState): void {
    this.writeFontSizeOverride(state.wordId, state.fontSize);
  }

  cleanupOnEnd(): void {
    this.originalFontSize = null;
  }

  private writeFontSizeOverride(wordId: string, fontSize: number): void {
    const previous = this.editorStore.snapshot().wordStyleOverrides.get(wordId);
    this.setWordStyleOverride.execute(wordId, { ...previous, fontSize });
  }

  private tryStart(target: WordResizeTarget, event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.host.isSessionActive()) return;
    const scaler = this.host.scaler();
    if (!scaler) return;
    const span = this.findWordSpan(scaler, target.wordId);
    if (!span) return;
    const originalFontSize = this.readRenderedFontSizeAsCqh(span, scaler);
    if (originalFontSize === null) return;
    event.stopPropagation();
    this.originalFontSize = originalFontSize;
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

  /** Round-trips the span's rendered font-size from px back into the
   *  `cqh` unit the override expects — the only container is the
   *  scaler (declared `container-type: size` in CSS), so its height
   *  is the 100cqh reference. Returns null when the scaler has no
   *  measurable height (e.g. before the first layout). */
  private readRenderedFontSizeAsCqh(span: HTMLElement, scaler: HTMLElement): number | null {
    const fontSizePx = parseFloat(getComputedStyle(span).fontSize);
    if (!Number.isFinite(fontSizePx)) return null;
    const scalerHeight = scaler.clientHeight;
    if (scalerHeight <= 0) return null;
    return (fontSizePx / scalerHeight) * 100;
  }
}
