import { CssVariable } from '@tscaps/engine';

/**
 * Builds the inline style records the per-letter animation contract
 * relies on: the word container exposes the total letter count and
 * each letter span exposes its index, so templates can drive
 * staggered keyframes via `var(--tscaps-letter-index)`. Stateless;
 * the engine vocabulary stays inside this class so the renderer
 * layer never references engine constants directly.
 */
export class LetterAnimationStyleBuilder {
  /** CSS vars set on the wrapper that hosts the per-letter spans. */
  buildWordContainerVars(letterCount: number): Record<string, string> {
    return { [CssVariable.LETTER_COUNT]: String(letterCount) };
  }

  /** CSS vars set on an individual letter span at position `letterIndex`. */
  buildLetterVars(letterIndex: number): Record<string, string> {
    return { [CssVariable.LETTER_INDEX]: String(letterIndex) };
  }
}
