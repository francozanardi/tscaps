import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

// `url(...)` with what it points at captured, quoted or not.
const URL_REFERENCE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
// Fragment references (`url(#filter)`) and inline data stay on the machine.
const LOCAL_URL = /^(#|data:)/i;
const IMPORT_RULE = /@import\b/i;
// Functions that load a resource without `url()` around it.
const URL_TAKING_FUNCTION = /\b(image-set|src)\s*\(\s*['"]/i;
const MAX_INLINE_DATA_CHARS = 400_000;

/**
 * Keeps CSS a program writes from reaching the network. The editor draws
 * element CSS in its own page and its export fetches every resource the
 * CSS names, so a `url()` pointing anywhere would be fetched with the
 * project open: fine for what a person types, not for text a model
 * wrote after reading a transcript someone else could have written.
 * Fragment references and inline `data:` (of a bounded size) pass;
 * any other `url()`, `@import`, and `image-set()` or `src()` with a
 * quoted address are refused.
 */
export class CssWriteGate {
  /** One error problem per thing refused in `css`; empty when it may be written. */
  check(css: string): OperationProblem[] {
    const problems: OperationProblem[] = [];
    for (const match of css.matchAll(URL_REFERENCE)) {
      const target = match[2] ?? '';
      if (!LOCAL_URL.test(target)) {
        problems.push(this.refused(`url(${target.slice(0, 60)}) points outside the project; only url(#id) and inline data: URLs are allowed.`));
      } else if (target.length > MAX_INLINE_DATA_CHARS) {
        problems.push(this.refused(`An inline data: URL of ${target.length} characters is over the ${MAX_INLINE_DATA_CHARS} allowed.`));
      }
    }
    if (IMPORT_RULE.test(css)) problems.push(this.refused('@import is not allowed: nothing outside the project can be loaded.'));
    if (URL_TAKING_FUNCTION.test(css)) problems.push(this.refused('image-set() and src() with an address are not allowed: nothing outside the project can be loaded.'));
    return problems;
  }

  private refused(message: string): OperationProblem {
    return { severity: 'error', message };
  }
}
