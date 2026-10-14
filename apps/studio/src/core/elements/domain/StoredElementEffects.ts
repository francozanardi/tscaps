import { ELEMENT_BLEND_MODES, type ElementBlendMode, type ElementEffects } from '@core/elements/domain/ElementEffects';

/**
 * An element's effects read back out of storage.
 *
 * An effect this build does not know is dropped rather than kept: the
 * renderer would have nothing to paint it with, and a record that
 * claims an effect nothing renders would show as set in a panel that
 * cannot offer it. The element then paints as if it had never been
 * given one.
 */
export class StoredElementEffects {

  /** The effects the payload describes, or nothing when it describes none. */
  static read(value: unknown): ElementEffects | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const { blend } = value as { blend?: unknown };
    if (!StoredElementEffects.isBlendMode(blend)) return undefined;
    return { blend };
  }

  private static isBlendMode(value: unknown): value is ElementBlendMode {
    return typeof value === 'string' && (ELEMENT_BLEND_MODES as ReadonlyArray<string>).includes(value);
  }
}
