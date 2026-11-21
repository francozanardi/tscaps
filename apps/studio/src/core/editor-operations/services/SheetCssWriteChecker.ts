import type { SvgFilterDefinitionsParser } from '@tscaps/engine';
import type { CssBlockSealer, CssMinifier } from '@tscaps/engine/advanced';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { TemplateContractContext } from '@core/templates/domain/contract/TemplateContractContext';
import type { TemplateContractValidator } from '@core/templates/services/contract/TemplateContractValidator';

// `url(...)` with what it points at captured, quoted or not.
const URL_REFERENCE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
const LOCAL_STAND_IN = 'url(#)';
// An `href` or `xlink:href` attribute, with what it points at captured.
const HREF_ATTRIBUTE = /\b(?:xlink:)?href\s*=\s*(['"])(.*?)\1/gi;
// Fragment references and inline data stay on the machine.
const LOCAL_HREF = /^(#|data:)/i;

/**
 * Checks CSS, or SVG filters, a program wants to put in place of a
 * sheet's template CSS or filters, before and after it is written.
 *
 * Refused: what would reach the network (see `CssWriteGate`), except the
 * image files the template's own CSS already loads, which a caller
 * sends back when it rewrites that CSS; and braces that do not pair up,
 * because a sheet's CSS is wrapped in the template's cascade layer as
 * it stands — a stray `}` ends that layer early and one left open
 * swallows every layer after it, breaking every caption the sheet
 * paints. Warned about: what the template contract says will not draw
 * as written.
 *
 * For filters, refused: what would reach the network, by `url()` or by
 * an `href`, and a source that does not parse as filters (every
 * `<filter>` with an id, no SMIL animation in one), which would leave
 * the sheet with none. An empty source is a sheet with no filters.
 */
export class SheetCssWriteChecker {
  constructor(
    private readonly gate: CssWriteGate,
    private readonly minifier: CssMinifier,
    private readonly sealer: CssBlockSealer,
    private readonly contractValidator: TemplateContractValidator,
    private readonly filtersParser: SvgFilterDefinitionsParser,
  ) {}

  /** One error problem per reason `css` must not replace `sheet`'s CSS; empty when it may. */
  refusals(sheet: Sheet, css: string): OperationProblem[] {
    return [...this.gate.check(this.withoutTemplateFiles(sheet, css)), ...this.unpairedBraces(css)];
  }

  /** One warning per breach of the template contract `css` makes as `sheet`'s CSS. */
  warnings(sheet: Sheet, css: string): OperationProblem[] {
    return this.contractValidator
      .validateCss(css, this.contractContextOf(sheet))
      .map((violation) => ({ severity: 'warning', message: violation.message }));
  }

  /** One error problem per reason `svg` must not replace a sheet's filters source; empty when it may. */
  filtersRefusals(svg: string): OperationProblem[] {
    const reaching = [...this.gate.check(svg), ...this.outsideHrefs(svg)];
    if (reaching.length > 0) return reaching;
    // An empty source is a sheet with no filters, which is valid and parses as nothing.
    if (svg.trim() === '') return [];
    try {
      this.filtersParser.parse(svg);
      return [];
    } catch (error) {
      return [{ severity: 'error', message: `The filters do not parse: ${error instanceof Error ? error.message : String(error)}` }];
    }
  }

  /** One warning per breach of the template contract `svg` makes as `sheet`'s filters source. */
  filtersWarnings(sheet: Sheet, svg: string): OperationProblem[] {
    if (svg.trim() === '') return [];
    return this.contractValidator
      .validateFiltersSvg(svg, this.contractContextOf(sheet))
      .map((violation) => ({ severity: 'warning', message: violation.message }));
  }

  /** `css` with every `url()` the template's own CSS also holds pointed at a local fragment instead. */
  private withoutTemplateFiles(sheet: Sheet, css: string): string {
    const ownTargets = new Set([...sheet.template.getCss().matchAll(URL_REFERENCE)].map((match) => match[2] ?? ''));
    if (ownTargets.size === 0) return css;
    return css.replace(URL_REFERENCE, (reference: string, _quote: string, target: string) => (ownTargets.has(target) ? LOCAL_STAND_IN : reference));
  }

  private outsideHrefs(svg: string): OperationProblem[] {
    return [...svg.matchAll(HREF_ATTRIBUTE)]
      .map((match) => match[2] ?? '')
      .filter((target) => !LOCAL_HREF.test(target))
      .map((target): OperationProblem => ({ severity: 'error', message: `href="${target.slice(0, 60)}" points outside the project; only #id and inline data: URLs are allowed.` }));
  }

  private unpairedBraces(css: string): OperationProblem[] {
    const { strayClosers, appendedClosers } = this.sealer.seal(this.minifier.minify(css));
    const problems: OperationProblem[] = [];
    if (strayClosers > 0) {
      problems.push({ severity: 'error', message: `${strayClosers} closing brace(s) close nothing; that would end the template's layer early and break every caption of the sheet. Fix the braces.` });
    }
    if (appendedClosers > 0) {
      problems.push({ severity: 'error', message: `${appendedClosers} block(s) are never closed; that would pull every rule after the sheet's CSS inside them. Fix the braces.` });
    }
    return problems;
  }

  private contractContextOf(sheet: Sheet): TemplateContractContext {
    return {
      styleControlIds: sheet.template.styleControls.map((field) => field.id),
      filterIds: this.filterIdsOf(sheet),
      fontStackIds: sheet.template.fontStackIds,
    };
  }

  private filterIdsOf(sheet: Sheet): ReadonlySet<string> {
    try {
      return this.filtersParser.parse(sheet.resolveFiltersSvg()).ids;
    } catch {
      // A filters source that does not parse defines no filter a
      // reference could match; the CSS checks go on without them.
      return new Set();
    }
  }
}
