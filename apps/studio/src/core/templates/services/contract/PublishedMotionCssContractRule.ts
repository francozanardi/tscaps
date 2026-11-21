import type { CssFragmentBlock, CssFragmentParser, CssKeyframesScanner } from '@tscaps/engine/advanced';
import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';

const KEYFRAMES_PRELUDE = /^@(-webkit-|-moz-)?keyframes\b/;
const GENERATED_BOX = /::?(before|after)$/;
const SELECTOR_SEPARATOR = /,(?![^(]*\))/;
const ANIMATION_PROPERTY = /^animation(-|$)/;
/** The `animation` `declared.plays` writes, which plays both ends of one kind. */
const PLAYS_BOTH_ENDS = /^var\(--(segment|line|word|decoration)-entrance-animation,\s*none\),\s*var\(--\1-exit-animation,\s*none\)$/;

/**
 * Flags motion a template plays on a caption element through `animation`
 * itself, rather than through `declared.plays`.
 *
 * An element has one `animation`, and the editor answers its two ends
 * at different levels, so an exit picked in the editor declares the
 * `animation` both ends share and takes the place of any the template
 * wrote. A template that writes it loses its motion the moment someone
 * picks an exit, and nothing on screen says why. `declared.plays`
 * publishes the motion in its end's slot instead, where an exit plays
 * after it.
 *
 * Two kinds of rule keep writing `animation`: one on a generated box,
 * since an exit played on the element reaches the box without replacing
 * the box's own; and one moving letters, which have no ends in the
 * editor — known from the record, as the keyframes the template
 * declared on letters.
 *
 * Stands down when the record is absent — a template loaded for editing
 * carries none.
 */
export class PublishedMotionCssContractRule implements CssContractRule {
  constructor(
    private readonly parser: CssFragmentParser,
    private readonly keyframesScanner: CssKeyframesScanner,
  ) {}

  check(minifiedCss: string, context: TemplateContractContext): ContractViolation[] {
    const letters = context.letterAnimationKeyframes;
    if (context.declaredAnimationKeyframes === undefined || letters === undefined) return [];
    return this.styleRulesIn(minifiedCss).flatMap((rule) => this.violationsIn(rule, letters));
  }

  /** Every style rule, those inside conditional at-rules included; keyframes play nothing. */
  private styleRulesIn(css: string): CssFragmentBlock[] {
    return this.parser.parse(css).flatMap((part) => {
      if (part.kind !== 'block' || KEYFRAMES_PRELUDE.test(part.prelude)) return [];
      return part.prelude.startsWith('@') ? this.styleRulesIn(this.bodyOf(part)) : [part];
    });
  }

  private violationsIn(rule: CssFragmentBlock, letters: ReadonlySet<string>): ContractViolation[] {
    if (this.addressesOnlyBoxes(rule)) return [];
    return this.parser.parse(this.bodyOf(rule)).flatMap((part) => {
      if (part.kind !== 'declaration' || !ANIMATION_PROPERTY.test(part.property)) return [];
      if (part.property === 'animation' && PLAYS_BOTH_ENDS.test(part.value.trim())) return [];
      if (this.movesOnlyLetters(part.property, part.value, letters)) return [];
      return [{
        message: `"${rule.prelude.trim()}" plays "${part.property}: ${part.value.trim()}" itself. `
          + 'Play a caption element\'s motion through `@include declared.plays(\'<element>\', $entrance: …)`, '
          + 'or `$exit:` for one it leaves with: an exit picked in the editor replaces an `animation` the template '
          + 'writes, and plays after one the template publishes.',
      }];
    });
  }

  private addressesOnlyBoxes(rule: CssFragmentBlock): boolean {
    return rule.prelude.split(SELECTOR_SEPARATOR).every((selector) => GENERATED_BOX.test(selector.trim()));
  }

  private movesOnlyLetters(property: string, value: string, letters: ReadonlySet<string>): boolean {
    const names = [...this.keyframesScanner.referencedNames(`x{${property}:${value}}`)];
    return names.length > 0 && names.every((name) => letters.has(name));
  }

  private bodyOf(block: CssFragmentBlock): string {
    return block.text.slice(block.text.indexOf('{') + 1, block.text.lastIndexOf('}'));
  }
}
