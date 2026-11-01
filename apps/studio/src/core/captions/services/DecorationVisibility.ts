import type { DecorationOverride } from '@core/captions/domain/DecorationOverride';

/**
 * Decides whether a per-word decoration survives the current emoji
 * effect state. Decorations the user added (`source === 'user'`) or
 * whose glyph the user edited stay visible regardless of the toggle;
 * decorations marked `removed` are always hidden. Of the ones
 * transcription picked, only the caption's own pick (`isCaptionPick`)
 * shows, and only while the effect is on.
 */
export class DecorationVisibility {
  isVisible(override: DecorationOverride, emojiEffectEnabled: boolean, isCaptionPick: boolean): boolean {
    if (override.removed) return false;
    if (this.isChosenByUser(override)) return true;
    return emojiEffectEnabled && isCaptionPick;
  }

  /** Whether the user added the decoration or changed its glyph, which makes it theirs rather than transcription's. */
  isChosenByUser(override: DecorationOverride): boolean {
    return override.source === 'user' || override.glyph !== undefined;
  }
}
