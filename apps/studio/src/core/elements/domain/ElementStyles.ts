import { PHYSICAL_SIDES, VERTICAL_ALIGNS } from '@tscaps/engine';
import { ELEMENT_KINDS, type ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ELEMENT_ANIMATION_SCOPES, type ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import { StoredElementAnimation } from '@core/elements/domain/StoredElementAnimation';
import { StoredElementControlValues } from '@core/elements/domain/StoredElementControlValues';
import type { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/** What each field holds, by control id. A field with no entry here was never moved. */
export type ElementFieldValues = Readonly<Record<string, ElementControlValue>>;

/** What each part of the element was told to do. A scope with no entry here animates however the template makes it. */
export type ElementAnimations = Readonly<Partial<Record<ElementAnimationScope, ElementAnimation>>>;

/** Everything the editor holds about how one element renders. */
export interface ElementStyle {
  readonly kind: ElementKind;
  /** What each of the element's parts was told to do. Absent leaves all of them to the template. */
  readonly animations?: ElementAnimations;
  /** What the fields were left at. The same values are declared in `css`. */
  readonly fields?: ElementFieldValues;
  /** Absent leaves the element where the layout puts it. */
  readonly placement?: ElementPlacement;
  /** The element's own CSS: what the fields wrote, and whatever was written by hand beside it. */
  readonly css: string;
}

/** What one write changes, where a key present and `undefined` takes that part back. */
type ElementStyleChanges = { readonly [K in keyof ElementStyle]?: ElementStyle[K] | undefined };

/** Plain shape for serialization. Keys are element ids; only elements with something to say are present. */
export type ElementStylesSnapshot = Readonly<Record<string, ElementStyle>>;

/**
 * How each element is styled, keyed by the element's id.
 *
 * A field's value is recorded here and declared in `css`, and the two
 * are written together. Nothing ever reads the CSS to find out what a
 * field holds — the record already knows. The only question ever asked
 * of the text is whether it still carries the exact declaration the
 * recorded value would write; when it does not, the CSS was edited by
 * hand and the field says so instead of arguing with it.
 *
 * An animation is recorded the same way and written the same way, and
 * its block goes first — so anything after it outranks it, exactly as
 * a field is outranked. What it takes to swap one is the difference: a
 * field owns a declaration, an animation owns a set of them plus its
 * keyframes, so the last one comes out whole rather than being
 * overwritten in place.
 *
 * An element can hold one animation per part of itself, so they are
 * keyed by scope. Two blocks in one text never collide: each carries
 * the selector and the clock its scope resolves to, so no two of them
 * can read the same.
 *
 * One store spans every kind of element — word, segment, decoration,
 * and whatever gains an id next. The kind rides along because the id
 * alone cannot tell a segment from a word, and both the clock an
 * entrance anchors to and the reflow exclusions depend on it.
 *
 * Immutable. `with` returns a new instance; an entry with neither an
 * entrance nor CSS is dropped, so `has` reflects what actually renders.
 */
export class ElementStyles {
  static empty(): ElementStyles {
    return new ElementStyles(new Map());
  }

  /** Entries whose kind is not one this build knows are dropped rather than trusted. */
  static fromSnapshot(snapshot: ElementStylesSnapshot): ElementStyles {
    const entries = new Map<string, ElementStyle>();
    for (const [id, style] of Object.entries(snapshot)) {
      if (!ElementStyles.isKnownKind(style?.kind)) continue;
      const css = typeof style.css === 'string' ? style.css : '';
      const animations = ElementStyles.readAnimations(style.animations);
      const fields = StoredElementControlValues.read(style.fields);
      const placement = ElementStyles.readPlacement(style.placement);
      if (css.trim().length === 0 && animations === undefined && fields === undefined && placement === undefined) continue;
      entries.set(id, {
        kind: style.kind,
        ...(animations !== undefined ? { animations } : {}),
        ...(fields !== undefined ? { fields } : {}),
        ...(placement !== undefined ? { placement } : {}),
        css,
      });
    }
    return new ElementStyles(entries);
  }

  private static isKnownKind(value: unknown): value is ElementKind {
    return typeof value === 'string' && (ELEMENT_KINDS as ReadonlyArray<string>).includes(value);
  }

  /**
   * The stored animations, minus any recorded against a scope this
   * build does not offer or in a shape that does not hold. Each one
   * dropped leaves that part of the element on the template's.
   */
  private static readAnimations(value: unknown): ElementAnimations | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const animations: Partial<Record<ElementAnimationScope, ElementAnimation>> = {};
    for (const scope of ELEMENT_ANIMATION_SCOPES) {
      const animation = StoredElementAnimation.read((value as Record<string, unknown>)[scope]);
      if (animation !== undefined) animations[scope] = animation;
    }
    return Object.keys(animations).length > 0 ? animations : undefined;
  }

  /**
   * A stored placement, or nothing when any of its four parts is
   * missing or the wrong type.
   *
   * All or none: an offset whose anchor did not survive is read against
   * whatever the sheet happens to hold now, which puts the element
   * somewhere nobody dropped it. Back in the flow is wrong in a way the
   * user can see and fix; somewhere plausible is not.
   */
  private static readPlacement(value: unknown): ElementPlacement | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const { verticalAlign, verticalOffset, horizontalAlign, horizontalOffset } = value as Partial<ElementPlacement>;
    if (verticalAlign === undefined || !VERTICAL_ALIGNS.includes(verticalAlign)) return undefined;
    if (horizontalAlign === undefined || !PHYSICAL_SIDES.includes(horizontalAlign)) return undefined;
    if (typeof verticalOffset !== 'number' || !Number.isFinite(verticalOffset)) return undefined;
    if (typeof horizontalOffset !== 'number' || !Number.isFinite(horizontalOffset)) return undefined;
    return { verticalAlign, verticalOffset, horizontalAlign, horizontalOffset };
  }

  private constructor(private readonly entries: ReadonlyMap<string, ElementStyle>) {}

  get(elementId: string): ElementStyle | null {
    return this.entries.get(elementId) ?? null;
  }

  has(elementId: string): boolean {
    return this.entries.has(elementId);
  }

  /**
   * What one of the element's fields was left at, when it holds a
   * number. `null` when the field was never moved, and when it holds
   * text — which is a field the caller has confused for another, since
   * a control writes one shape or the other and never both.
   */
  fieldNumber(elementId: string, fieldId: ElementFieldId): number | null {
    const held = this.heldBy(elementId, fieldId);
    return typeof held === 'number' ? held : null;
  }

  /** What one of the element's fields was left at, when it holds text. */
  fieldText(elementId: string, fieldId: ElementFieldId): string | null {
    const held = this.heldBy(elementId, fieldId);
    return typeof held === 'string' ? held : null;
  }

  /** The stack one of the element's fields was left at, or `null` when the field was never moved. */
  fieldStack(elementId: string, fieldId: ElementFieldId): FontStack | null {
    return FontStack.fromStoredFaces(this.heldBy(elementId, fieldId));
  }

  private heldBy(elementId: string, fieldId: ElementFieldId): ElementControlValue | undefined {
    return this.entries.get(elementId)?.fields?.[fieldId];
  }

  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  /** Every styled element, so the renderer stamps ids on exactly those. */
  elementIds(): ReadonlySet<string> {
    return new Set(this.entries.keys());
  }

  /** The styled elements that are segments, as this store's contribution to the reflow exclusions. */
  segmentIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const [id, style] of this.entries) {
      if (style.kind === 'segment') ids.add(id);
    }
    return ids;
  }

  all(): ReadonlyMap<string, ElementStyle> {
    return this.entries;
  }

  /**
   * Every styled element, the ones that wrap others before the ones
   * they wrap.
   *
   * A caption can be told how the words inside it animate, which is a
   * rule reaching elements that answer for themselves too. Both land in
   * the same cascade layer at the same specificity, so the only thing
   * left to separate them is which was written first — and the one the
   * user pointed at has to win over the one that came with the caption
   * around it. Elements of the same kind keep the order they were
   * added in.
   */
  outermostFirst(): ReadonlyArray<readonly [string, ElementStyle]> {
    return [...this.entries].sort(
      ([, left], [, right]) => ELEMENT_KINDS.indexOf(left.kind) - ELEMENT_KINDS.indexOf(right.kind),
    );
  }

  /** Replaces the element's CSS, leaving everything else at what it was. */
  withCss(elementId: string, kind: ElementKind, css: string): ElementStyles {
    return this.replacing(elementId, kind, { css });
  }

  /**
   * Records which animation one part of the element was given, together
   * with the CSS that animation wrote. Passing `undefined` leaves that
   * part animating however the template makes it.
   *
   * The two arrive in one call for the same reason a field's do: an
   * animation stored without its block animates nothing, and a block
   * stored without the animation behind it can never be swapped again.
   */
  withAnimation(
    elementId: string,
    kind: ElementKind,
    scope: ElementAnimationScope,
    animation: ElementAnimation | undefined,
    css: string,
  ): ElementStyles {
    const { [scope]: _replaced, ...kept } = this.entries.get(elementId)?.animations ?? {};
    const animations = animation === undefined ? kept : { ...kept, [scope]: animation };
    return this.replacing(elementId, kind, { animations, css });
  }

  /** What one part of the element was told to do, or `null` when it was left to the template. */
  animationOf(elementId: string, scope: ElementAnimationScope): ElementAnimation | null {
    return this.entries.get(elementId)?.animations?.[scope] ?? null;
  }

  /**
   * Records what a field was left at, together with the CSS that field
   * wrote. The two arrive in one call because a value stored without
   * its declaration paints nothing, and a declaration stored without
   * its value can never be moved again.
   */
  withField(
    elementId: string,
    kind: ElementKind,
    controlId: string,
    value: ElementControlValue,
    css: string,
  ): ElementStyles {
    const fields = { ...this.entries.get(elementId)?.fields, [controlId]: value };
    return this.replacing(elementId, kind, { fields, css });
  }

  /** Forgets what a field held, alongside the CSS that is left once it stops writing. */
  withoutField(elementId: string, kind: ElementKind, controlId: string, css: string): ElementStyles {
    const current = this.entries.get(elementId);
    if (!current) return this;
    const { [controlId]: _forgotten, ...fields } = current.fields ?? {};
    return this.replacing(elementId, kind, { fields, css });
  }

  /** Passing `undefined` returns the element to the flow it was laid out in. */
  withPlacement(elementId: string, kind: ElementKind, placement: ElementPlacement | undefined): ElementStyles {
    return this.replacing(elementId, kind, { placement });
  }

  /** Where the element was put, or `null` when it is still in the flow. */
  placementOf(elementId: string): ElementPlacement | null {
    return this.entries.get(elementId)?.placement ?? null;
  }

  /**
   * Drops every entry whose element is absent from `liveElementIds`.
   * Returns `this` when they all survive.
   */
  restrictedTo(liveElementIds: ReadonlySet<string>): ElementStyles {
    const orphaned = [...this.entries.keys()].filter((id) => !liveElementIds.has(id));
    return orphaned.length > 0 ? this.without(orphaned) : this;
  }

  without(elementIds: Iterable<string>): ElementStyles {
    let next: Map<string, ElementStyle> | null = null;
    for (const id of elementIds) {
      if (!this.entries.has(id)) continue;
      next ??= new Map(this.entries);
      next.delete(id);
    }
    return next ? new ElementStyles(next) : this;
  }

  toSnapshot(): ElementStylesSnapshot {
    return Object.fromEntries(this.entries);
  }

  /**
   * Lays `changes` over what the element already holds, dropping the
   * entry once it says nothing at all. Returns `this` when the result
   * is what was already there, so a rewrite of the same value wakes
   * nobody up.
   *
   * A key absent from `changes` is left alone; one present and
   * `undefined` is taken back, which is how an entrance or a placement
   * is cleared.
   */
  private replacing(elementId: string, kind: ElementKind, changes: ElementStyleChanges): ElementStyles {
    const current = this.entries.get(elementId);
    const style = this.compacted({ ...current, ...changes, kind, css: changes.css ?? current?.css ?? '' });
    if (this.saysNothing(style) && !current) return this;
    if (current && this.sameStyle(current, style)) return this;

    const next = new Map(this.entries);
    if (this.saysNothing(style)) next.delete(elementId);
    else next.set(elementId, style);
    return new ElementStyles(next);
  }

  /** The same style with every part that holds nothing left out, so two equal styles serialize alike. */
  private compacted(style: ElementStyleChanges & Pick<ElementStyle, 'kind' | 'css'>): ElementStyle {
    const { animations, fields, placement, ...rest } = style;
    const holdsValues = fields !== undefined && Object.keys(fields).length > 0;
    const holdsAnimations = animations !== undefined && Object.keys(animations).length > 0;
    return {
      ...rest,
      ...(holdsAnimations ? { animations } : {}),
      ...(holdsValues ? { fields } : {}),
      ...(placement !== undefined ? { placement } : {}),
    };
  }

  private saysNothing(style: ElementStyle): boolean {
    return style.css.trim().length === 0
      && style.animations === undefined
      && style.fields === undefined
      && style.placement === undefined;
  }

  private sameStyle(left: ElementStyle, right: ElementStyle): boolean {
    return left.kind === right.kind
      && left.css === right.css
      && JSON.stringify(left.animations ?? null) === JSON.stringify(right.animations ?? null)
      && JSON.stringify(left.fields ?? null) === JSON.stringify(right.fields ?? null)
      && JSON.stringify(left.placement ?? null) === JSON.stringify(right.placement ?? null);
  }
}
