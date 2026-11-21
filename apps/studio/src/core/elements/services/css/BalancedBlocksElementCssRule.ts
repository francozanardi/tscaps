import type { CssBlockSealer } from '@tscaps/engine/advanced';
import type { ElementCssProblem } from '@core/elements/domain/ElementCssProblem';
import type { ElementCssRule } from '@core/elements/domain/ElementCssRule';

/**
 * Reports braces that do not pair up.
 *
 * The text is pasted inside a selector written for it, so an unbalanced
 * brace does not break its own line — it moves the boundary of the block
 * around it. What renders is repaired rather than dropped, which means
 * that without this the user sees something other than what they typed
 * and no reason for it.
 */
export class BalancedBlocksElementCssRule implements ElementCssRule {
  constructor(private readonly sealer: CssBlockSealer) {}

  check(minifiedCss: string): ElementCssProblem[] {
    const { strayClosers, appendedClosers } = this.sealer.seal(minifiedCss);
    const problems: ElementCssProblem[] = [];
    if (strayClosers > 0) problems.push({ message: this.strayCloserMessage(strayClosers) });
    if (appendedClosers > 0) problems.push({ message: this.unclosedBlockMessage(appendedClosers) });
    return problems;
  }

  private strayCloserMessage(count: number): string {
    return count === 1
      ? 'One closing brace has nothing to open it. It is dropped.'
      : `${count} closing braces have nothing to open them. They are dropped.`;
  }

  private unclosedBlockMessage(count: number): string {
    return count === 1
      ? 'One block is never closed. Everything below it is pulled inside.'
      : `${count} blocks are never closed. Everything below them is pulled inside.`;
  }
}
