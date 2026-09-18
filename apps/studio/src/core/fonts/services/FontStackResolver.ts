import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import type { FontStack } from '@core/fonts/domain/FontStack';
import type { CompiledFamilyNamer } from '@core/fonts/services/CompiledFamilyNamer';
import type { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import { SYSTEM_FONT_FAMILIES } from '@core/fonts/domain/SystemFontFamily';

/**
 * Resolves a stack to the CSS families that draw it: its managed faces
 * as one compiled family, plus the explicit Other choice when needed.
 *
 * No managed face sits behind the composite: that would conceal a
 * compiler failure with a plausible substitute and unmeasured metrics.
 * The Other family is different. It is an explicit choice for letters
 * the compiler does not manage, and is omitted when none are present.
 */
export class FontStackResolver {

  constructor(
    private readonly namer: CompiledFamilyNamer,
    private readonly faceResolver: DrawableFamilyResolver,
  ) {}

  /** A null script set names the faces plainly: template builds and gallery previews compile nothing. */
  resolve(stack: FontStack, scripts: CaptionScripts | null): string {
    if (scripts === null) return this.quoteAll(stack.ledBy('latin'));
    const identity = this.faceResolver.identity(stack, scripts);
    const families = this.faceResolver.assignments(stack, scripts).length === 0
      ? []
      : [this.namer.nameFor(identity)];
    if (scripts.hasOtherLetters) families.push(stack.familyFor('other'));
    return this.formatAll(families);
  }

  private quoteAll(families: ReadonlyArray<string>): string {
    return families.map((family) => `'${family}'`).join(', ');
  }

  private formatAll(families: ReadonlyArray<string>): string {
    return families.map((family) => this.isSystemFamily(family) ? family : `'${family}'`).join(', ');
  }

  private isSystemFamily(family: string): boolean {
    return (SYSTEM_FONT_FAMILIES as readonly string[]).includes(family);
  }
}
