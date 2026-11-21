import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

/** A field value as read: a number, a flag, or text (a font stack is read as its Latin face). */
export type ReadoutValue = string | number | boolean;

/** One animation an element's part was given: the preset (null for told not to move) and the fields moved off its defaults. */
export interface AnimationReadout {
  readonly preset: string | null;
  readonly params?: Readonly<Record<string, ReadoutValue>>;
}

/**
 * The style one element carries of its own, as a read answers it: its
 * CSS, the fields it was given, an animation per part (keyed by scope),
 * where it was placed in the frame and how it blends. A part that holds
 * nothing is left out.
 */
export interface ElementStyleReadoutRow {
  readonly css?: string;
  readonly fields?: Readonly<Record<string, ReadoutValue>>;
  readonly animations?: Readonly<Record<string, AnimationReadout>>;
  readonly placement?: ElementPlacement;
  readonly blend?: string;
}

const NO_FIELDS: ReadonlySet<string> = new Set();

/** Reads the style record an element carries of its own into the compact shape a read answers with. */
export class ElementStyleReadout {
  constructor(private readonly format: ReadoutFormatter) {}

  /**
   * What `style` holds, or null when there is no style or it holds
   * nothing. Fields named in `fieldsSaidElsewhere` are left out, for an
   * answer that already says them another way. Long inline data: URLs
   * in the CSS are described rather than repeated.
   */
  of(style: ElementStyle | null, fieldsSaidElsewhere: ReadonlySet<string> = NO_FIELDS): ElementStyleReadoutRow | null {
    if (style === null) return null;
    const css = style.css.trim();
    const fields = this.fieldsOf(style, fieldsSaidElsewhere);
    const animations = this.animationsOf(style);
    const row: ElementStyleReadoutRow = {
      ...(css.length > 0 ? { css: this.format.text(css) } : {}),
      ...(fields === null ? {} : { fields }),
      ...(animations === null ? {} : { animations }),
      ...(style.placement === undefined ? {} : { placement: this.placementOf(style.placement) }),
      ...(style.effects?.blend === undefined ? {} : { blend: style.effects.blend }),
    };
    return Object.keys(row).length === 0 ? null : row;
  }

  /** What one animation holds, its fields read as values. */
  animation(animation: ElementAnimation): AnimationReadout {
    const params = Object.entries(animation.params);
    return {
      preset: animation.presetId,
      ...(params.length === 0 ? {} : { params: Object.fromEntries(params.map(([id, value]) => [id, this.format.value(value)])) }),
    };
  }

  private fieldsOf(style: ElementStyle, fieldsSaidElsewhere: ReadonlySet<string>): Record<string, ReadoutValue> | null {
    const fields = Object.entries(style.fields ?? {}).filter(([id]) => !fieldsSaidElsewhere.has(id));
    return fields.length === 0 ? null : Object.fromEntries(fields.map(([id, value]) => [id, this.format.value(value)]));
  }

  private animationsOf(style: ElementStyle): Record<string, AnimationReadout> | null {
    const animations = Object.entries(style.animations ?? {}).flatMap(([scope, animation]) =>
      (animation === undefined ? [] : [[scope, this.animation(animation)] as const]));
    return animations.length === 0 ? null : Object.fromEntries(animations);
  }

  private placementOf(placement: ElementPlacement): ElementPlacement {
    return {
      verticalAlign: placement.verticalAlign,
      verticalOffset: this.format.share(placement.verticalOffset),
      horizontalAlign: placement.horizontalAlign,
      horizontalOffset: this.format.share(placement.horizontalOffset),
    };
  }
}
