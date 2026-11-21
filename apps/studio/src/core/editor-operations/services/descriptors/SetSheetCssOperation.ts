import { z } from 'zod';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetCssWriteChecker } from '@core/editor-operations/services/SheetCssWriteChecker';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { UpdateSheetCssOverrideAction } from '@core/sheets/actions/style/UpdateSheetCssOverrideAction';
import type { UpdateSheetFiltersSvgOverrideAction } from '@core/sheets/actions/style/UpdateSheetFiltersSvgOverrideAction';
import type { Sheet } from '@core/sheets/domain/Sheet';

const MAX_CSS_CHARS = 200_000;

/**
 * `set_sheet_css`: puts CSS in place of a sheet's whole template CSS,
 * and SVG filters in place of its template's filters, or gives the
 * sheet either back, as the Code tab does. A source equal to what the
 * sheet already draws is not written again. Both are checked before
 * either is written. The captions are laid out again before it answers,
 * so what reads or renders them next sees the new sources.
 */
export class SetSheetCssOperation implements EditorOperation {
  readonly name = 'set_sheet_css';
  readonly effect = 'edit';
  readonly description = [
    'REPLACES THE WHOLE CSS of a sheet\'s template with `css`: every rule the template had is dropped and only what you send is drawn, for every caption painted with that sheet and the sheets linked to it.',
    'To tweak it, read the sheet\'s current CSS first (get_element with include), change what you need and send all of it back; `css: null` gives the sheet its template\'s own CSS again.',
    '`filtersSvg` does the same for its SVG filters (<filter id> elements CSS uses as url(#id)): keep the template\'s filters when you add one.',
    'Prefer set_style_controls when a control does what is wanted, and set_element_css for a single element. Only url(#id), inline data: URLs and the image files the template\'s CSS already uses may appear.',
    'Answers what the template contract finds (variables nothing writes, classes captions never carry, unknown keyframes) as warnings.',
  ].join(' ');

  private readonly input = new OperationInput({
    css: z.string().max(MAX_CSS_CHARS).nullable().optional().describe('The sheet\'s complete CSS, replacing the template\'s; null restores the template\'s CSS.'),
    filtersSvg: z.string().max(MAX_CSS_CHARS).nullable().optional().describe('The sheet\'s whole <svg> filters source.'),
    sheet: z.string().optional().describe('The sheet, as a ref: sheet:<id>. The active sheet when left out.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly sheets: SheetRefResolver,
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly activeSheetEdits: ActiveSheetEditRunner,
    private readonly updateSheetCssOverride: UpdateSheetCssOverrideAction,
    private readonly updateSheetFiltersSvgOverride: UpdateSheetFiltersSvgOverrideAction,
    private readonly refresh: RefreshDocumentAction,
    private readonly checker: SheetCssWriteChecker,
    private readonly reflow: CaptionReflowDetector,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { css, filtersSvg } = checked.value;
    if (css === undefined && filtersSvg === undefined) {
      return this.refused([{ severity: 'error', message: 'Give css, filtersSvg or both.' }]);
    }
    const resolved = this.sheets.resolve(checked.value.sheet);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const sheet = resolved.value;
    const sheetRef = this.parser.formatOf('sheet', sheet.id);
    const refusals = [
      ...(typeof css === 'string' ? this.checker.refusals(sheet, css) : []),
      ...(typeof filtersSvg === 'string' ? this.checker.filtersRefusals(filtersSvg) : []),
    ];
    if (refusals.length > 0) return this.refused(refusals.map((problem) => ({ ...problem, ref: sheetRef })));

    const cssChanged = css !== undefined && !this.alreadyDraws(sheet, css);
    const filtersChanged = filtersSvg !== undefined && !this.alreadyFilters(sheet, filtersSvg);
    const before = this.store.snapshot().document;
    if (cssChanged || filtersChanged) {
      this.activeSheetEdits.runOn(sheet.id, () => {
        if (filtersChanged && filtersSvg !== undefined) this.updateSheetFiltersSvgOverride.execute(filtersSvg);
        if (cssChanged && css !== undefined) this.updateSheetCssOverride.execute(css);
      });
      this.refresh.execute();
    }
    const written = this.store.sheet(sheet.id) ?? sheet;
    const warnings = [
      ...(typeof filtersSvg === 'string' ? this.checker.filtersWarnings(written, filtersSvg) : []),
      ...(typeof css === 'string' ? this.checker.warnings(written, css) : []),
    ].map((problem) => ({ ...problem, ref: sheetRef }));
    const reflowed = this.reflow.warningFor(before, this.store.snapshot().document);
    return {
      ok: true,
      output: {
        sheet: sheetRef,
        ...(css === undefined ? {} : { css: this.sourceOf(css) }),
        ...(filtersSvg === undefined ? {} : { filtersSvg: this.sourceOf(filtersSvg) }),
        changed: cssChanged || filtersChanged,
      },
      problems: reflowed === null ? warnings : [...warnings, reflowed],
    };
  }

  private sourceOf(source: string | null): 'template' | 'custom' {
    return source === null ? 'template' : 'custom';
  }

  /** Whether writing `css` would leave the sheet as it is: the same text, or the template's CSS asked back while it has it. */
  private alreadyDraws(sheet: Sheet, css: string | null): boolean {
    return css === null ? sheet.cssOverride === null : sheet.resolveCss() === css;
  }

  /** Whether writing `svg` would leave the sheet's filters as they are, the way {@link alreadyDraws} reads CSS. */
  private alreadyFilters(sheet: Sheet, svg: string | null): boolean {
    return svg === null ? sheet.filtersSvgOverride === null : sheet.resolveFiltersSvg() === svg;
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
