import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import type { ElementBlendMode } from '@core/elements/domain/ElementEffects';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';

/**
 * Sets how one element composites against the picture beneath it.
 *
 * Blending an element takes the blend off everything inside it. A blend
 * inside a blend composites against the group it sits in rather than
 * against the video, which paints as close to nothing, so an element
 * left with its own answer would stop doing what its panel says while
 * nothing on screen explained why. Answering further out is the way the
 * user says "all of this", so it wins over what is inside.
 */
export class SetElementBlendAction {
  constructor(
    private readonly store: EditorStore,
    private readonly descendantResolver: ElementDescendantResolver,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(elementId: string, kind: ElementKind, blend: ElementBlendMode): void {
    let next = this.store.snapshot().elementStyles.withBlend(elementId, kind, blend);
    for (const descendantId of this.descendantResolver.descendantsOf(elementId)) {
      const style = next.get(descendantId);
      if (style?.effects?.blend === undefined) continue;
      next = next.withBlend(descendantId, style.kind, undefined);
    }
    this.apply(next, elementId);
  }

  /** Paints the element over the picture as usual again. What is inside it is left alone. */
  clear(elementId: string, kind: ElementKind): void {
    this.apply(this.store.snapshot().elementStyles.withBlend(elementId, kind, undefined), elementId);
  }

  private apply(elementStyles: ElementStyles, elementId: string): void {
    const snap = this.store.snapshot();
    if (elementStyles === snap.elementStyles) return;

    this.store.commit(`elementBlend:${elementId}`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }
}
