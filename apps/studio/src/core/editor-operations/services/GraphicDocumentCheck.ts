import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicField } from '@core/graphics/domain/GraphicField';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';
import type { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import type { GraphicFontFamilyCheck } from '@core/editor-operations/services/GraphicFontFamilyCheck';

/** The parts of a graphic's document a caller wrote; a part left out is not checked. */
export type GraphicDocumentParts = { readonly [Part in keyof GraphicDocument]?: string | undefined };

// What reaches the network from JavaScript, each with the name a warning gives it.
const NETWORK_CALLS: ReadonlyArray<{ readonly pattern: RegExp; readonly name: string }> = [
  { pattern: /\bfetch\s*\(/, name: 'fetch()' },
  { pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' },
  { pattern: /\bWebSocket\b/, name: 'WebSocket' },
  { pattern: /\bEventSource\b/, name: 'EventSource' },
  { pattern: /\bimport\s*\(/, name: 'import()' },
  { pattern: /\bimportScripts\s*\(/, name: 'importScripts()' },
  { pattern: /\bsendBeacon\s*\(/, name: 'sendBeacon()' },
  { pattern: /\bnew\s+(?:Shared)?Worker\s*\(/, name: 'a Worker' },
];
// An attribute naming a resource by its address instead of holding it inline.
const RESOURCE_BY_ADDRESS = /\b(?:src|href|srcset|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//i;
const ELEMENT_THAT_LOADS = /<(?:link|iframe|object|embed)\b/i;
const SCRIPT_ELEMENT = /<script\b/i;
const PAGE_ELEMENT = /<(?:!doctype|html|head|body)\b/i;
// The ways code reads a field: tscaps.params.name, tscaps.params['name'], const { name } = tscaps.params.
const PARAM_BY_NAME = /tscaps\.params\.([A-Za-z_$][\w$]*)/g;
const PARAM_BY_KEY = /tscaps\.params\[\s*(['"`])([^'"`]+)\1\s*\]/g;
const PARAMS_DESTRUCTURED = /\{([^{}]*)\}\s*=\s*tscaps\.params\b/g;

/**
 * Reads what a graphic's code will do before it runs: an error for each
 * thing in its CSS that would reach the network, as `CssWriteGate`
 * refuses it, and a warning for what will not work as written. The
 * graphic plays in a sandbox that blocks the network whatever its code
 * asks, so a network call or a resource by address is a warning, not an
 * error: the graphic draws without it. Static reading only; playing the
 * graphic is what finds the rest.
 */
export class GraphicDocumentCheck {
  constructor(
    private readonly gate: CssWriteGate,
    private readonly fonts: GraphicFontFamilyCheck,
  ) {}

  /**
   * The problems of `parts`, for a graphic declaring `fields`: errors for
   * CSS that would reach the network; warnings for a network call in the
   * JavaScript, a field it reads that `fields` does not declare, a
   * resource by address, a `<script>` or a whole page's tags in the HTML,
   * and a font no bundled face draws, in the CSS or the HTML.
   */
  check(parts: GraphicDocumentParts, fields: ReadonlyArray<GraphicField>): OperationProblem[] {
    return [
      ...(parts.css === undefined ? [] : this.cssErrors(parts.css)),
      ...(parts.css === undefined ? [] : this.fontWarnings('css', parts.css)),
      ...(parts.html === undefined ? [] : this.fontWarnings('html', parts.html)),
      ...(parts.html === undefined ? [] : this.htmlWarnings(parts.html)),
      ...(parts.js === undefined ? [] : this.jsWarnings(parts.js, fields)),
    ];
  }

  private cssErrors(css: string): OperationProblem[] {
    return this.gate.check(css).map((problem) => ({ ...problem, message: `css: ${problem.message}` }));
  }

  private fontWarnings(part: 'css' | 'html', text: string): OperationProblem[] {
    const unknown = this.fonts.unknownFamilies(text);
    if (unknown.length === 0) return [];
    const names = unknown.map((family) => `'${family}'`).join(', ');
    return [this.warning(`${part}: ${names} is not a font tscaps has, so each device draws it with a font of its own and the export can differ; name one from the graphics guide, or from the fonts guide (read_guide fonts).`)];
  }

  private htmlWarnings(html: string): OperationProblem[] {
    const warnings = this.gate.check(html).map((problem) => this.warning(`html: ${problem.message} The graphic will not load it.`));
    if (RESOURCE_BY_ADDRESS.test(html) || ELEMENT_THAT_LOADS.test(html)) {
      warnings.push(this.warning('html: it names a resource by address (an image, a font, a page), which the graphic will not load; draw it inline with SVG, canvas or a data: URL.'));
    }
    if (SCRIPT_ELEMENT.test(html)) {
      warnings.push(this.warning('html: a <script> there runs while the page is still being laid out, before the box has its size; put all code in js.'));
    }
    if (PAGE_ELEMENT.test(html)) {
      warnings.push(this.warning('html: it is the content of the body; leave out <!doctype>, <html>, <head> and <body>.'));
    }
    return warnings;
  }

  private jsWarnings(js: string, fields: ReadonlyArray<GraphicField>): OperationProblem[] {
    const warnings: OperationProblem[] = [];
    const calls = NETWORK_CALLS.filter(({ pattern }) => pattern.test(js)).map(({ name }) => name);
    if (calls.length > 0) {
      warnings.push(this.warning(`js: it uses ${calls.join(', ')}, which the graphic's sandbox refuses: nothing outside the graphic can be reached, so draw from what the page holds and from tscaps.params.`));
    }
    const declared = new Set(fields.map((field) => field.id));
    const undeclared = [...this.paramsReadBy(js)].filter((fieldId) => !declared.has(fieldId));
    if (undeclared.length > 0) {
      warnings.push(this.warning(`js: it reads ${undeclared.map((fieldId) => `tscaps.params.${fieldId}`).join(', ')}, which no field declares, so the value is undefined; declare each in fields.`));
    }
    return warnings;
  }

  /** The field ids `js` reads off `tscaps.params`, as far as reading the text can tell. */
  private paramsReadBy(js: string): ReadonlySet<string> {
    const read = new Set<string>();
    for (const match of js.matchAll(PARAM_BY_NAME)) read.add(match[1]!);
    for (const match of js.matchAll(PARAM_BY_KEY)) read.add(match[2]!);
    for (const match of js.matchAll(PARAMS_DESTRUCTURED)) {
      for (const entry of match[1]!.split(',')) {
        const name = entry.split(/[:=]/)[0]!.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(name)) read.add(name);
      }
    }
    return read;
  }

  private warning(message: string): OperationProblem {
    return { severity: 'warning', message };
  }
}
