import { memo, useCallback, useState } from 'react';
import { BookmarkPlus, Save } from 'lucide-react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { PromptDialog } from '@ui/_shared/components/Dialog/PromptDialog';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

const BUTTON_CLASS =
  'shrink-0 grid place-items-center w-[30px] h-[30px] rounded-xs bg-surface-2 border border-edge-medium text-fg-muted cursor-pointer '
  + 'transition-colors duration-quick ease-standard hover:border-edge-strong hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 disabled:cursor-wait';

interface SaveGraphicPresetButtonProps {
  layerId: string;
  /** The saved preset the graphic was made from, which *Save* writes over; null for a graphic made from none. */
  savedOrigin: GraphicPreset | null;
  /** The name the *Save as new preset* dialog offers to start from. */
  suggestedName: string;
  onSaved: () => void;
}

/**
 * Saving the graphic `layerId` as it stands: *Save*, over the saved preset
 * it was made from, where there is one, and *Save as new preset*, which asks
 * for a name. A shipped preset is never written over.
 */
export const SaveGraphicPresetButton = memo(function SaveGraphicPresetButton({ layerId, savedOrigin, suggestedName, onSaved }: SaveGraphicPresetButtonProps) {
  const { actions, services } = useShots();
  const names = services.graphicPresetLibrary.names;
  const thumbnails = services.graphicPresetThumbnails;
  const [dialog, setDialog] = useState<{ busy: boolean; error: string | null } | null>(null);
  const [overwriting, setOverwriting] = useState(false);

  const saveAsNew = useCallback(async (name: string) => {
    setDialog({ busy: true, error: null });
    try {
      await actions.saveGraphicPreset.execute(layerId, name);
      setDialog(null);
      onSaved();
    } catch (error) {
      setDialog({ busy: false, error: error instanceof Error ? error.message : 'The preset could not be saved.' });
    }
  }, [actions, layerId, onSaved]);

  const overwrite = useCallback(async () => {
    setOverwriting(true);
    try {
      const saved = await actions.saveGraphicPreset.overwrite(layerId);
      if (saved !== null) thumbnails.release(saved.id);
      onSaved();
    } catch (error) {
      console.error('[graphics] the preset could not be saved', error);
    }
    setOverwriting(false);
  }, [actions, layerId, thumbnails, onSaved]);

  return (
    <>
      {savedOrigin !== null && (
        <Tooltip text={`Save changes to “${savedOrigin.name}”`}>
          <button type="button" className={BUTTON_CLASS} aria-label={`Save changes to ${savedOrigin.name}`} disabled={overwriting} onClick={() => { void overwrite(); }}>
            <Save size={15} strokeWidth={2} />
          </button>
        </Tooltip>
      )}
      <Tooltip text="Save as a new preset">
        <button type="button" className={BUTTON_CLASS} aria-label="Save as a new preset" onClick={() => setDialog({ busy: false, error: null })}>
          <BookmarkPlus size={15} strokeWidth={2} />
        </button>
      </Tooltip>
      <PromptDialog
        open={dialog !== null}
        label="Preset name"
        defaultValue={suggestedName}
        confirmLabel="Save"
        validate={(name) => names.problemWith(name)}
        maxLength={names.maxLength}
        errorMessage={dialog?.error ?? null}
        loading={dialog?.busy ?? false}
        onConfirm={(name) => { void saveAsNew(name); }}
        onCancel={() => setDialog(null)}
      />
    </>
  );
});
