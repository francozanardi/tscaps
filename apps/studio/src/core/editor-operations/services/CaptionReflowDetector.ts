import type { Document } from '@tscaps/engine';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

/**
 * Tells a caller when an edit laid the captions out again under refs it
 * may still hold. A scene keeps its id only while it keeps the same
 * words in the same order, so a re-split that regroups words retires
 * the refs of the scenes it touched; line ids change on every layout.
 * Word ids never change. Where the captions carry emojis, it says the
 * suggested emojis may have changed too: they are suggested for a layout,
 * so regrouping words can suggest others.
 */
export class CaptionReflowDetector {
  /**
   * A warning when scenes of `before` are missing from `after`, naming
   * how many; null when every scene kept its ref, or when either side
   * holds no captions.
   */
  warningFor(before: Document | null, after: Document | null): OperationProblem | null {
    if (before === null || after === null) return null;
    const kept = new Set(after.getSegments().map((segment) => segment.id));
    const gone = before.getSegments().filter((segment) => !kept.has(segment.id)).length;
    if (gone === 0) return null;
    const emojis = this.holdsEmojis(after) ? ', and the suggested emojis may have changed with the layout, by design' : '';
    return {
      severity: 'warning',
      message: `The captions were re-split, retiring ${gone} scene ref(s) read before this call; line refs changed too${emojis}. Word refs still hold: read the transcript again before using segment or line refs.`,
    };
  }

  private holdsEmojis(document: Document): boolean {
    return document.getWords().some((word) => word.decoration !== null);
  }
}
