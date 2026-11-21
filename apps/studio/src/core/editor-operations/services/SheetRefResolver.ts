import type { EditorStore } from '@core/editor/store/EditorStore';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ResolvedRef } from '@core/editor-operations/domain/ResolvedRef';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';

/** Finds the style sheet a ref names, or the active one when none is named. */
export class SheetRefResolver {
  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
  ) {}

  /** The sheet `text` names (`sheet:<id>`), or the active sheet when `text` is undefined. */
  resolve(text: string | undefined): ResolvedRef<Sheet> {
    if (text === undefined) {
      const active = this.store.activeSheet();
      return active === null
        ? { ok: false, problem: { severity: 'error', message: 'The project has no style sheet yet.' } }
        : { ok: true, value: active };
    }
    const ref = this.parser.parse(text);
    if (ref === null || ref.kind !== 'sheet') {
      return { ok: false, problem: { severity: 'error', message: `"${text}" is not a sheet ref; sheet refs look like sheet:<id>.`, ref: text } };
    }
    const sheet = this.store.sheet(ref.id);
    return sheet === null
      ? { ok: false, problem: { severity: 'error', message: `${text} is not a sheet of this project.`, ref: text } }
      : { ok: true, value: sheet };
  }
}
