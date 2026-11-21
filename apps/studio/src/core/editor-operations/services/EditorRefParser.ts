import { EDITOR_REF_KINDS, type EditorRef, type EditorRefKind } from '@core/editor-operations/domain/EditorRef';

const KINDS: ReadonlySet<string> = new Set(EDITOR_REF_KINDS);

/** Reads and writes refs as the `kind:id` text they travel as. */
export class EditorRefParser {
  /** `text` as a ref, or null when it names no known kind or holds no id. Splits on the first colon only. */
  parse(text: string): EditorRef | null {
    const colon = text.indexOf(':');
    if (colon <= 0 || colon === text.length - 1) return null;
    const kind = text.slice(0, colon);
    if (!KINDS.has(kind)) return null;
    return { kind: kind as EditorRefKind, id: text.slice(colon + 1) };
  }

  format(ref: EditorRef): string {
    return `${ref.kind}:${ref.id}`;
  }

  /** The ref of `kind` for `id`, as text. */
  formatOf(kind: EditorRefKind, id: string): string {
    return `${kind}:${id}`;
  }
}
