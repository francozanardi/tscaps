import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { DecorationOverride } from '@core/captions/domain/DecorationOverride';

/**
 * Sets the persisted per-decoration override for `decorationId` to the
 * given record. Passing an override with no fields drops the registry
 * entry. Re-derives the document so the new glyph and / or time are
 * visible in the preview.
 */
export class SetDecorationOverrideAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  execute(decorationId: string, override: DecorationOverride): void {
    const current = this.store.snapshot().decorationOverrides;
    const next = current.with(decorationId, override);
    this.store.commit(`decorationOverride:${decorationId}`);
    this.store.patch({ decorationOverrides: next });
    this.refresh.execute();
  }
}
