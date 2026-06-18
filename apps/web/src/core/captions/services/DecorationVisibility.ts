import type { DecorationOverride } from '@core/captions/domain/DecorationOverride';

/**
 * Decides whether a per-word decoration survives the current emoji
 * effect state. Decorations the user added (`source === 'user'`) or
 * whose glyph the user edited stay visible regardless of the toggle;
 * decorations marked `removed` are always hidden; everything else
 * follows the effect's enabled flag.
 */
export class DecorationVisibility {
  isVisible(override: DecorationOverride, emojiEffectEnabled: boolean): boolean {
    if (override.removed) return false;
    if (override.source === 'user') return true;
    if (override.glyph !== undefined) return true;
    return emojiEffectEnabled;
  }
}
