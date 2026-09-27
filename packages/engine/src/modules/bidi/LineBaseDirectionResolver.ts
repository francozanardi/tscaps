import type { BidiCharacterClassifier } from '@modules/bidi/BidiCharacterClassifier';
import type { TextDirection } from '@modules/bidi/TextDirection';

/**
 * Picks the base direction one line is laid out against: the declared
 * one, unless every strong character in the line reads the other way.
 *
 * Only a line written in a single direction can be flipped, because
 * there the base moves the neutrals at its edges and nothing else. A
 * line mixing both keeps the declared base, which is where the choice
 * reorders words.
 */
export class LineBaseDirectionResolver {

  constructor(private readonly characterClassifier: BidiCharacterClassifier) {}

  /** `declaredDirection` unless `text` has strong characters and none of them read that way. */
  resolve(text: string, declaredDirection: TextDirection): TextDirection {
    let sawOpposite = false;
    for (const character of text) {
      const direction = this.characterClassifier.strongDirectionOf(character);
      if (direction === declaredDirection) return declaredDirection;
      if (direction !== null) sawOpposite = true;
    }
    return sawOpposite ? this.opposite(declaredDirection) : declaredDirection;
  }

  private opposite(direction: TextDirection): TextDirection {
    return direction === 'ltr' ? 'rtl' : 'ltr';
  }
}
