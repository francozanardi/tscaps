import { memo, useCallback, useState } from 'react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { PromptDialog } from '@ui/_shared/components/Dialog/PromptDialog';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What is being done to a saved preset: renaming it or deleting it. */
export type SavedGraphicPresetEdit = { readonly kind: 'rename' | 'delete'; readonly preset: GraphicPreset };

interface SavedGraphicPresetDialogsProps {
  /** The edit asked for, or null for none. */
  edit: SavedGraphicPresetEdit | null;
  /** Heard once the edit is done or cancelled. */
  onClose: () => void;
}

/**
 * The dialogs that rename a saved preset or confirm deleting it. A rename
 * that fails stays open with why; a deleted preset's thumbnail is given
 * back.
 */
export const SavedGraphicPresetDialogs = memo(function SavedGraphicPresetDialogs({ edit, onClose }: SavedGraphicPresetDialogsProps) {
  const { services } = useShots();
  const library = services.graphicPresetLibrary;
  const thumbnails = services.graphicPresetThumbnails;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setBusy(false);
    setError(null);
    onClose();
  }, [onClose]);

  const rename = useCallback(async (preset: GraphicPreset, name: string) => {
    setBusy(true);
    setError(null);
    try {
      await library.actions.rename.execute(preset.id, name);
      close();
    } catch (failure) {
      setBusy(false);
      setError(failure instanceof Error ? failure.message : 'The preset could not be renamed.');
    }
  }, [library, close]);

  const remove = useCallback(async (preset: GraphicPreset) => {
    setBusy(true);
    try {
      await library.actions.delete.execute(preset.id);
      thumbnails.release(preset.id);
    } catch (failure) {
      console.error('[graphics] the saved preset could not be deleted', failure);
    }
    close();
  }, [library, thumbnails, close]);

  return (
    <>
      <PromptDialog
        open={edit?.kind === 'rename'}
        label="Rename preset"
        defaultValue={edit?.preset.name ?? ''}
        confirmLabel="Rename"
        validate={(name) => library.names.problemWith(name)}
        maxLength={library.names.maxLength}
        errorMessage={error}
        loading={busy}
        onConfirm={(name) => { if (edit !== null) void rename(edit.preset, name); }}
        onCancel={close}
      />
      <ConfirmDialog
        open={edit?.kind === 'delete'}
        message={`Delete the preset “${edit?.preset.name ?? ''}”? Graphics made from it keep how they look.`}
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={() => { if (edit !== null) void remove(edit.preset); }}
        onCancel={close}
      />
    </>
  );
});
