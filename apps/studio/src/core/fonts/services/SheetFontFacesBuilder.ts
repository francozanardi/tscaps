import type { FontFaceCssBuilder } from '@core/fonts/services/FontFaceCssBuilder';
import type { FontStackCompiler } from '@core/fonts/services/FontStackCompiler';
import type {
  SheetFontFamilyCollector,
  SheetFontFamilyCollectorInput,
} from '@core/fonts/services/SheetFontFamilyCollector';

export interface SheetFontFacesRequest extends SheetFontFamilyCollectorInput {
  /**
   * Code points the rules have to cover, or `null` to keep every subset
   * the faces declare. Pass the set where the rules are embedded in what
   * ships — each subset is inlined whole there, so one nothing draws is
   * pure weight. Pass `null` where they are fetched by URL, since the
   * browser then skips a subset the text never reaches on its own.
   */
  readonly usedCodepoints: ReadonlySet<number> | null;
}

/**
 * Writes every `@font-face` rule a sheet renders with: one family per
 * stack in play, compiled, plus the plain rules for families the CSS
 * names as text.
 *
 * The two are kept apart because they are reached differently. A stack
 * is reached through the value this app emits, so it can be given a
 * family of its own and be sized and ordered as one. A name written
 * into a stylesheet by hand is reached by that name, so it has to keep
 * it — and it draws only the alphabets its own face covers, which is
 * the price of naming a family instead of choosing a font.
 */
export class SheetFontFacesBuilder {

  constructor(
    private readonly collector: SheetFontFamilyCollector,
    private readonly compiler: FontStackCompiler,
    private readonly fontFaceCssBuilder: FontFaceCssBuilder,
  ) {}

  build(request: SheetFontFacesRequest): string {
    const written = new Set<string>();
    const blocks: string[] = [];
    for (const stack of this.collector.collectStacks(request)) {
      const compiled = this.compiler.compile({
        stack,
        scripts: request.sheet.scripts,
        usedCodepoints: request.usedCodepoints,
      });
      if (written.has(compiled.family) || compiled.css === '') continue;
      written.add(compiled.family);
      blocks.push(compiled.css);
    }
    const literals = this.fontFaceCssBuilder.build(
      this.collector.collectLiteralFamilies(request),
      request.usedCodepoints,
    );
    if (literals !== '') blocks.push(literals);
    return blocks.join('\n');
  }

}
