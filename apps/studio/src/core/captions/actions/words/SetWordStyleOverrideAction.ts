import type { EditorStore } from '@core/editor/store/EditorStore';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';

const STYLE_FIELDS: readonly (keyof WordStyleOverrides)[] = [
  'fontWeight', 'italic', 'underline', 'strikethrough', 'fontSize', 'color',
];

export class SetWordStyleOverrideAction {
  constructor(private readonly store: EditorStore) {}

  /**
   * Commits per-word overrides with an undo entry coalesced by the set of
   * fields that actually changed vs. the previous overrides — a rapid color
   * drag (only `color` differs each tick) collapses into a single history
   * step instead of flooding the stack with one entry per `onChange`.
   */
  execute(wordId: string, overrides: WordStyleOverrides): void {
    const current = this.store.snapshot().wordStyleOverrides;
    const previous = current.get(wordId);
    const next = current.with(wordId, overrides);
    const changed = STYLE_FIELDS.filter((k) => previous[k] !== overrides[k]);
    const key = changed.length > 0
      ? `wordStyleOverride:${wordId}:${changed.join(',')}`
      : undefined;
    this.store.commit(key);
    this.store.patch({ wordStyleOverrides: next });
  }
}
