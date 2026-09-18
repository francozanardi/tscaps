import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementFieldId } from '@core/elements/domain/fields/ElementFieldId';
import { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import type { CssFontFamilyReader } from '@core/fonts/services/CssFontFamilyReader';
import type { DrawableFamilyResolver } from '@core/fonts/services/DrawableFamilyResolver';
import type { DrawingFamilyFilter } from '@core/fonts/services/DrawingFamilyFilter';
import type { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import type { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { SYSTEM_FONT_FAMILIES } from '@core/fonts/domain/SystemFontFamily';

export interface SheetFontFamilyCollectorInput {
  readonly sheet: Sheet;
  readonly document: Document;
  readonly sheetCss: string;
  readonly elementStyles: ElementStyles;
}

/** Collects declared stacks and literal CSS families needed to render a sheet. */
export class SheetFontFamilyCollector {

  constructor(
    private readonly drawableFamilyResolver: DrawableFamilyResolver,
    private readonly scriptClassifier: FontScriptClassifier,
    private readonly captionTextCollector: SheetCaptionTextCollector,
    private readonly cssFamilyReader: CssFontFamilyReader,
    private readonly drawingFamilyFilter: DrawingFamilyFilter,
    private readonly fontStackLibrary: FontStackLibrary,
  ) {}

  /** Every family the sheet can reach, whether it arrives through a stack or by name. */
  collect(input: SheetFontFamilyCollectorInput): Set<string> {
    const scripts = this.scriptsOf(input);
    const families = this.collectLiteralFamilies(input);
    for (const stack of this.collectStacks(input)) {
      for (const family of this.drawableFamilyResolver.resolve(stack, scripts)) families.add(family);
    }
    return families;
  }

  /** Whether unsupported letters can reach a browser-chosen generic family on this sheet. */
  usesDeviceFont(input: SheetFontFamilyCollectorInput): boolean {
    if (!this.scriptsOf(input).hasOtherLetters) return false;
    return this.collectStacks(input).some((stack) =>
      (SYSTEM_FONT_FAMILIES as readonly string[]).includes(stack.familyFor('other')),
    );
  }

  /** Every stack in play, each once, the sheet's own first. */
  collectStacks(input: SheetFontFamilyCollectorInput): FontStack[] {
    const stacks = new Map<string, FontStack>();
    this.addStack(input.sheet.typographyConfig.fontStack, stacks);
    this.addPerElementStacks(input, stacks);
    this.addFontControlStacks(input.sheet, stacks);
    for (const id of input.sheet.template.fontStackIds) this.addStack(this.fontStackLibrary.stackFor(id), stacks);
    return [...stacks.values()];
  }

  /** Literal CSS keeps its ordinary meaning; only structured font fields select stacks. */
  collectLiteralFamilies(input: SheetFontFamilyCollectorInput): Set<string> {
    const scripts = this.scriptsOf(input);
    const named = new Set<string>();
    for (const css of this.stylesheetsOf(input)) {
      for (const list of this.cssFamilyReader.lists(css)) {
        for (const family of this.drawingFamilyFilter.reachable(list, scripts)) {
          named.add(family);
        }
      }
    }
    if (scripts.hasOtherLetters) {
      for (const stack of this.collectStacks(input)) named.add(stack.familyFor('other'));
    }
    return named;
  }

  private stylesheetsOf(input: SheetFontFamilyCollectorInput): string[] {
    return [input.sheetCss, ...[...input.elementStyles.all().values()].map((style) => style.css)];
  }

  /** Preloading happens before the sheet has been synchronized, so read the document directly. */
  private scriptsOf(input: SheetFontFamilyCollectorInput): CaptionScripts {
    const text = this.captionTextCollector.collect(input.document, input.sheet.id);
    return new CaptionScripts(
      this.scriptClassifier.classifyWithLanguage(text),
      this.scriptClassifier.scriptsIn(text),
      this.scriptClassifier.readsAsUrdu(text),
      this.scriptClassifier.otherLetterCodepoints(text),
    );
  }

  private addPerElementStacks(input: SheetFontFamilyCollectorInput, out: Map<string, FontStack>): void {
    for (const section of input.document.sections) {
      if (section.kind !== input.sheet.id) continue;
      for (const segment of section.segments) {
        this.addChosenStack(input.elementStyles, segment.id, out);
        for (const line of segment.lines) {
          this.addChosenStack(input.elementStyles, line.id, out);
        }
        for (const word of segment.getWords()) {
          this.addChosenStack(input.elementStyles, word.id, out);
        }
      }
    }
  }

  private addChosenStack(elementStyles: ElementStyles, elementId: string, out: Map<string, FontStack>): void {
    const stack = elementStyles.fieldStack(elementId, ElementFieldId.FONT_FAMILY);
    if (stack !== null) this.addStack(stack, out);
  }

  private addFontControlStacks(sheet: Sheet, out: Map<string, FontStack>): void {
    for (const control of sheet.template.styleControls) {
      if (control.type !== 'font') continue;
      const stack = FontStack.fromStoredFaces(sheet.styleValues.values[control.id]);
      if (stack !== null) this.addStack(stack, out);
    }
  }

  // Keyed by the faces themselves: two elements given the same stack
  // compile to one family and would otherwise be written out twice.
  private addStack(stack: FontStack, out: Map<string, FontStack>): void {
    const key = JSON.stringify(stack.toSnapshot());
    if (!out.has(key)) out.set(key, stack);
  }
}
