import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import {
  ANIMATED_KIND_BY_SCOPE,
  ANIMATION_PHASE_BY_SCOPE,
  ELEMENT_ANIMATION_SCOPES,
  type ElementAnimationPhase,
  type ElementAnimationScope,
} from '@core/elements/domain/ElementAnimationScope';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';
import type { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import type { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';

const NO_PARAMS: Readonly<Record<string, ElementControlValue>> = {};

/**
 * Changes how one kind of element moves everywhere the active sheet
 * paints, by recording what was picked and the CSS it renders as.
 *
 * The same pair an element keeps, one rung further out. Each kind
 * carries its own block, so answering for the words leaves the one the
 * captions were given exactly as it was compiled — a later change to
 * the library reaches new picks and no saved project.
 *
 * Picking a *different* animation forgets the values the last one was
 * tuned to: they belong to fields that animation offered. Picking the
 * one already there is not a change and is treated as none, so a value
 * can be tuned and watched.
 *
 * A sheet's answer belongs to its link group the way every other style
 * edit does: linked siblings render alike or the link means nothing.
 */
export class ReplaceSheetAnimationAction {
  constructor(
    private readonly store: EditorStore,
    private readonly elementResolver: SheetElementResolver,
    private readonly animationCssBuilder: ElementAnimationCssBuilder,
    private readonly animationCssWriter: ElementAnimationCssWriter,
    private readonly linkedSheetsSync: LinkedSheetsSync,
    private readonly refresh: RefreshDocumentAction,
    private readonly supportResolver: AnimationSupportResolver,
  ) {}

  /** Gives the kind this animation, at its shipped values. Asking for the one it already has does nothing. */
  apply(scope: ElementAnimationScope, presetId: string): void {
    if (this.heldFor(scope)?.presetId === presetId) return;
    this.record(scope, { presetId, params: NO_PARAMS });
  }

  /** Leaves the kind moving however the template makes it. */
  clear(scope: ElementAnimationScope): void {
    if (this.heldFor(scope) === undefined) return;
    this.record(scope, undefined);
  }

  /** States that the kind does not move, whatever the template says. */
  disable(scope: ElementAnimationScope): void {
    if (this.heldFor(scope)?.presetId === null) return;
    this.record(scope, { presetId: null, params: NO_PARAMS });
  }

  /** Moves one of the animation's fields. Does nothing while the kind has no animation to tune. */
  setControl(scope: ElementAnimationScope, control: AuthoredElementControl, value: ElementControlValue): void {
    const current = this.heldFor(scope);
    if (!current) return;
    this.record(scope, { ...current, params: { ...current.params, [control.id]: value } });
  }

  private heldFor(scope: ElementAnimationScope): ElementAnimation | undefined {
    const held = this.store.activeSheet()?.animations.get(scope);
    return held?.kind === 'replaced' ? held.animation : undefined;
  }

  private record(scope: ElementAnimationScope, animation: ElementAnimation | undefined): void {
    const active = this.store.activeSheet();
    if (!active) return;
    // A template whose look does not survive an animation on this kind
    // is refused here as well as hidden in the panel: a link group
    // carries an edit across to siblings on other templates, and this
    // is the one place all of that passes through.
    if (!this.supportResolver.supports(active.template.features.animation, scope, null)) return;
    const snap = this.store.snapshot();
    const entry = animation === undefined
      ? undefined
      : { kind: 'replaced' as const, animation, css: this.animationCssBuilder.buildForEveryElement(animation, scope) };
    const animations = active.animations.with(scope, entry);
    if (animations === active.animations) return;

    const elementStyles = this.forgottenInside(snap.elementStyles, active.id, scope);
    this.store.commit('Change motion', `sheetAnimation:${active.id}:${scope}`);
    this.store.patch({
      sheets: this.linkedSheetsSync.applyStyleEdit(active.with({ animations }), snap.sheets),
      ...(elementStyles === snap.elementStyles ? {} : { elementStyles }),
    });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }

  /**
   * Takes their own answer off every element the sheet just answered
   * for, at the same end of their life.
   *
   * Answering out here is how the user says "all of this", and the
   * answer they give last is the one to obey. It reaches further than
   * an element's does: a caption told how its words arrive is holding
   * an answer *about words*, so a sheet answering for the words takes
   * that one too, not only the answers the words gave themselves.
   *
   * Which is why the kind is compared rather than the scope — the same
   * kind is reached from `self` on the element itself and from a scope
   * on the one around it, and both stop being the last word. The end is
   * compared too: how the words leave says nothing about how one of
   * them arrives, and the two ends play together.
   */
  private forgottenInside(
    styles: ElementStyles,
    sheetId: string,
    scope: ElementAnimationScope,
  ): ElementStyles {
    const reached = ANIMATED_KIND_BY_SCOPE[scope];
    if (reached === null) return styles;
    const phase = ANIMATION_PHASE_BY_SCOPE[scope];
    let next = styles;
    for (const elementId of this.elementResolver.elementsOf(sheetId)) {
      next = this.forgotten(next, elementId, reached, phase);
    }
    return next;
  }

  private forgotten(
    styles: ElementStyles,
    elementId: string,
    reached: ElementKind,
    phase: ElementAnimationPhase,
  ): ElementStyles {
    let next = styles;
    for (const scope of ELEMENT_ANIMATION_SCOPES) {
      const style = next.get(elementId);
      if (style === null) return next;
      const animation = style.animations?.[scope];
      if (animation === undefined) continue;
      if ((ANIMATED_KIND_BY_SCOPE[scope] ?? style.kind) !== reached) continue;
      if (ANIMATION_PHASE_BY_SCOPE[scope] !== phase) continue;
      const css = this.animationCssWriter.rewrite(style.css, style.kind, scope, animation, undefined);
      next = next.withAnimation(elementId, style.kind, scope, undefined, css);
    }
    return next;
  }
}
