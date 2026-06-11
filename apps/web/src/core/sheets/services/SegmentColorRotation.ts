import type { Sheet } from '@core/sheets/domain/Sheet';
import { TemplateCssVariable } from '@core/templates/domain/TemplateCssVariable';

type ColorRecipe = 'single' | 'sequential' | 'random';

const PALETTE_KEYS = ['highlight-color-1', 'highlight-color-2', 'highlight-color-3', 'highlight-color-4', 'highlight-color-5'] as const;

/**
 * Resolves a per-segment override for `--tscaps-highlight-color` based on the
 * sheet's color rotation configuration. Templates opt in by exposing a
 * `color-recipe` select control plus N `highlight-color-i` palette colors;
 * the consumer (SubtitleOverlay) merges the returned overrides into each
 * active segment's wrapper inline style. Returns an empty object when the
 * sheet doesn't opt in or when the recipe is `single` — in that case the
 * template's CSS naturally falls back to `--tscaps-highlight-color-1`.
 */
export class SegmentColorRotation {
  /**
   * @param sheet         The sheet whose template's controls are read.
   * @param segmentId     The active segment's stable id; used as the hash
   *                      seed for the `random` recipe so a given segment
   *                      always lands on the same color across renders.
   * @param segmentIndex  Position of the segment within its sheet's segment
   *                      list; used for `sequential` recipe.
   */
  resolveOverrides(sheet: Sheet, segmentId: string, segmentIndex: number): Record<string, string> {
    const values = sheet.styleValues.values;
    const recipe = values['color-recipe'] as ColorRecipe | undefined;
    if (!recipe || recipe === 'single') return {};

    const palette: string[] = [];
    for (const key of PALETTE_KEYS) {
      const c = values[key];
      if (typeof c === 'string') palette.push(c);
    }
    if (palette.length === 0) return {};

    const idx = recipe === 'sequential'
      ? segmentIndex % palette.length
      : this.hashStringToInt(segmentId) % palette.length;
    return { [TemplateCssVariable.HIGHLIGHT_COLOR]: palette[idx]! };
  }

  private hashStringToInt(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
}
