import type { EditorStore } from '@core/editor/store/EditorStore';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';

const TYPOGRAPHY_FIELDS: readonly (keyof WordStyleOverrides)[] = [
  'fontWeight', 'italic', 'underline', 'strikethrough', 'fontFamily', 'fontSize', 'color',
];

/**
 * Returns a word that was previously detached (had a position override
 * committed) back to its segment's line flow by stripping only the four
 * alignment fields from its overrides. Typography overrides (color,
 * font weight, etc.) are preserved — only the position is undone, so a
 * user who carefully tweaked a word's color before moving it doesn't
 * lose that work when sending the word back home.
 *
 * No-op when the word has no overrides at all or no alignment fields
 * set; the entry is removed from the registry when stripping the
 * alignment leaves the record empty.
 */
export class ClearWordAlignmentOverrideAction {
  constructor(private readonly store: EditorStore) {}

  execute(wordId: string): void {
    const current = this.store.snapshot().wordStyleOverrides;
    const previous = current.get(wordId);
    const stripped = this.typographyOnly(previous);
    const next = current.with(wordId, stripped);
    this.store.commit(`wordAlignmentClear:${wordId}`);
    this.store.patch({ wordStyleOverrides: next });
  }

  private typographyOnly(overrides: WordStyleOverrides): WordStyleOverrides {
    const kept: WordStyleOverrides = {};
    for (const field of TYPOGRAPHY_FIELDS) {
      const value = overrides[field];
      if (value !== undefined) Object.assign(kept, { [field]: value });
    }
    return kept;
  }
}
