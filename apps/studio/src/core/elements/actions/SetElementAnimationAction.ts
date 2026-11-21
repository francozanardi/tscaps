import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';

const NO_PARAMS: Readonly<Record<string, ElementControlValue>> = {};

/**
 * Changes how one part of an element moves, by recording what was
 * picked and writing what it looks like into the element's own CSS.
 *
 * Picking a *different* animation forgets the values the last one was
 * tuned to: they belong to fields that animation offered, and the new
 * one offers its own. Keeping them would leave a distance behind on an
 * animation that never travels. Picking the one already there is not a
 * change and is treated as none, so a value can be tuned and watched.
 *
 * Nothing happens to a part whose block has been taken over from the
 * code editor. The list has stopped deciding there, and the panel says
 * so rather than writing a second animation beside the one that was
 * written by hand. The element's other parts keep answering to the
 * list: each block is found on its own.
 */
export class SetElementAnimationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly descendantResolver: ElementDescendantResolver,
    private readonly animationCssWriter: ElementAnimationCssWriter,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  /** Gives the scope this animation, at its shipped values. Asking for the one it already has does nothing. */
  apply(elementId: string, kind: ElementKind, scope: ElementAnimationScope, presetId: string): void {
    if (this.store.snapshot().elementStyles.animationOf(elementId, scope)?.presetId === presetId) return;
    this.record(elementId, kind, scope, { presetId, params: NO_PARAMS });
  }

  /** Leaves the scope moving however the template makes it. */
  clear(elementId: string, kind: ElementKind, scope: ElementAnimationScope): void {
    this.record(elementId, kind, scope, undefined);
  }

  /** States that the scope does not move, whatever the template says. */
  disable(elementId: string, kind: ElementKind, scope: ElementAnimationScope): void {
    this.record(elementId, kind, scope, { presetId: null, params: NO_PARAMS });
  }

  /** Moves one of the animation's fields. Does nothing while the scope has no animation to tune. */
  setControl(
    elementId: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    control: AuthoredElementControl,
    value: ElementControlValue,
  ): void {
    const current = this.store.snapshot().elementStyles.animationOf(elementId, scope);
    if (!current) return;
    this.record(elementId, kind, scope, { ...current, params: { ...current.params, [control.id]: value } });
  }

  private record(
    elementId: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    animation: ElementAnimation | undefined,
  ): void {
    const snap = this.store.snapshot();
    const style = snap.elementStyles.get(elementId);
    const current = style?.animations?.[scope];
    const currentCss = style?.css ?? '';
    // The record would otherwise move while the CSS it describes stayed
    // where the code editor left it.
    if (current && this.animationCssWriter.isTakenOver(currentCss, kind, scope, current)) return;

    const css = this.animationCssWriter.rewrite(currentCss, kind, scope, current, animation);
    const set = snap.elementStyles.withAnimation(elementId, kind, scope, animation, css);
    const elementStyles = this.forgottenInside(set, elementId, scope);
    if (elementStyles === snap.elementStyles) return;

    this.store.commit('Change motion', `elementAnimation:${elementId}:${scope}`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }

  /**
   * Takes their own animation off the elements this scope reaches, at
   * the same end of their life.
   *
   * Answering further out is how the user says "all of this", and the
   * answer they give last is the one to obey. An element that kept its
   * own would have to be found and told again, one at a time, and
   * nothing on screen would say which ones were ignoring the caption.
   * Wanting one of them different means answering it after, not before.
   *
   * Only the same end: telling a caption's words how they leave says
   * nothing about how one of them arrives, and the two ends play
   * together, so a word keeps the entrance it was given.
   *
   * A scope that reaches nothing leaves everything inside alone: an
   * element's own animation moves the element and no part of what it
   * holds.
   */
  private forgottenInside(
    styles: ElementStyles,
    elementId: string,
    scope: ElementAnimationScope,
  ): ElementStyles {
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    if (reached === null) return styles;
    const own = ANIMATION_PHASE_BY_SCOPE[scope] === 'exit' ? ElementAnimationScope.EXIT : ElementAnimationScope.SELF;
    let next = styles;
    for (const descendantId of this.descendantResolver.descendantsOf(elementId)) {
      const style = next.get(descendantId);
      if (style === null || style.kind !== reached) continue;
      const animation = style.animations?.[own];
      if (animation === undefined) continue;
      const css = this.animationCssWriter.rewrite(style.css, style.kind, own, animation, undefined);
      next = next.withAnimation(descendantId, style.kind, own, undefined, css);
    }
    return next;
  }
}
