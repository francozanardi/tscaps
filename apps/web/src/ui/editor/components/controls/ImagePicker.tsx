import { memo, useCallback, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import type { ControlField } from '@core/templates/domain/ControlField';
import { AssetLibraryDialog } from '@ui/editor/components/controls/AssetLibraryDialog';
import { useAssetLibrary } from '@ui/_shared/contexts/modules/AssetLibraryContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

interface ImagePickerProps {
  field: ControlField;
  value: string;
  disabled?: boolean | undefined;
}

const TILE_BASE =
  'relative w-[44px] h-[44px] rounded-xs border overflow-hidden p-0 shrink-0 ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40';

const TILE_INTERACTIVE = `${TILE_BASE} cursor-pointer border-edge-medium hover:border-edge-strong disabled:opacity-40 disabled:cursor-not-allowed`;
const TILE_EMPTY = 'bg-surface-3 flex items-center justify-center text-fg-faint';

const FIELD_LABEL = 'flex-1 text-xs text-fg-muted whitespace-nowrap overflow-hidden text-ellipsis min-w-0';


const CHECKER_LAYERS = [
  'linear-gradient(45deg, #777 25%, transparent 25%)',
  'linear-gradient(-45deg, #777 25%, transparent 25%)',
  'linear-gradient(45deg, transparent 75%, #777 75%)',
  'linear-gradient(-45deg, transparent 75%, #777 75%)',
].join(', ');

function imageTileStyle(url: string): React.CSSProperties {
  return {
    backgroundImage: `url("${url}"), ${CHECKER_LAYERS}`,
    backgroundSize: 'contain, 8px 8px, 8px 8px, 8px 8px, 8px 8px',
    backgroundPosition: 'center, 0 0, 0 4px, 4px -4px, -4px 0',
    backgroundRepeat: 'no-repeat, repeat, repeat, repeat, repeat',
  };
}

/**
 * Field-row entry for an image-typed style control. Renders a small
 * preview tile that opens the asset library when clicked; the library
 * handles upload, pick, and delete.
 */
export const ImagePicker = memo(function ImagePicker({ field, value, disabled }: ImagePickerProps) {
  return <UnlockedImagePicker field={field} value={value} disabled={disabled} />;
});


interface UnlockedImagePickerProps {
  field: ControlField;
  value: string;
  disabled?: boolean | undefined;
}

const UnlockedImagePicker = memo(function UnlockedImagePicker({ field, value, disabled }: UnlockedImagePickerProps) {
  const { repository } = useAssetLibrary();
  const sheets = useSheets();
  const editorStore = useEditorStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const previewUrl = repository.resolve(value)?.url ?? null;

  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const onPick = useCallback((assetId: string | null) => {
    sheets.actions.style.setAsset.execute(field, assetId);
  }, [field, sheets]);

  const findUsage = useCallback(
    (assetId: string) => sheets.assetUsageInspector.findUsageOfAsset(assetId, editorStore.snapshot().sheets),
    [editorStore, sheets],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className={previewUrl ? TILE_INTERACTIVE : `${TILE_INTERACTIVE} ${TILE_EMPTY}`}
          style={previewUrl ? imageTileStyle(previewUrl) : {}}
          onClick={openDialog}
          disabled={disabled}
          aria-label={`Pick ${field.label}`}
          title={`Pick ${field.label}`}
        >
          {!previewUrl && <ImagePlus size={16} strokeWidth={2} />}
        </button>
        <span className={FIELD_LABEL}>{field.label}</span>
      </div>

      <AssetLibraryDialog
        open={dialogOpen}
        field={field}
        selectedAssetId={value}
        findUsage={findUsage}
        onPick={onPick}
        onClose={closeDialog}
      />
    </div>
  );
});
