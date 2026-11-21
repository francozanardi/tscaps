import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';

/**
 * Puts one element somewhere in the video frame, taking it out of the
 * flow it was laid out in.
 *
 * The whole placement is written at once — anchors included — because
 * an offset read against an anchor that is free to move afterwards
 * stops naming the place it named.
 */
export class SetElementPlacementAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(elementId: string, kind: ElementKind, placement: ElementPlacement): void {
    this.apply(this.store.snapshot().elementStyles.withPlacement(elementId, kind, placement), elementId);
  }

  /**
   * Returns the element to the flow it belongs to.
   *
   * How it looks is untouched: its fields and its CSS have nothing to
   * do with where it sits, so a word that was recoloured before being
   * moved keeps that when it is sent home.
   */
  clear(elementId: string, kind: ElementKind): void {
    this.apply(this.store.snapshot().elementStyles.withPlacement(elementId, kind, undefined), elementId);
  }

  /**
   * Coalesces into one undo step per element, so dragging leaves a
   * single entry rather than one per pointermove.
   */
  private apply(elementStyles: ElementStyles, elementId: string): void {
    const snap = this.store.snapshot();
    if (elementStyles === snap.elementStyles) return;

    this.store.commit('Change element position', `elementPlacement:${elementId}`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }
}
