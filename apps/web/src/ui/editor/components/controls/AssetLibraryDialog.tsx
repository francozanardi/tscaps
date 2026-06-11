import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ImagePlus, Trash2, Check, Loader2 } from 'lucide-react';
import type { ControlField } from '@core/templates/domain/ControlField';
import type { Asset } from '@core/templates/domain/Asset';
import type { UploadUserBlobFailure } from '@core/user-blobs/actions/UploadUserBlobAction';
import type { SheetStyleAssetUsage } from '@core/sheets/services/StyleAssetUsageInspector';
import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { useUserBlobs } from '@ui/_shared/contexts/modules/UserBlobsContext';
import { useAssetLibrary } from '@ui/_shared/contexts/modules/AssetLibraryContext';

const ACCEPTED_FILE_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml,image/avif,image/gif';

interface AssetLibraryDialogProps {
  open: boolean;
  field: ControlField;
  /** Currently-applied asset id (whatever its source). */
  selectedAssetId: string;
  /** Resolves the in-editor usage of an asset id at delete time. */
  findUsage: (assetId: string) => SheetStyleAssetUsage[];
  /** Picks `assetId` for the field; `null` means "reset to the field's default". */
  onPick: (assetId: string | null) => void;
  onClose: () => void;
}

const TILE_BASE =
  'relative aspect-square rounded-xs border overflow-hidden cursor-pointer p-0 ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

const TILE_IDLE = 'border-edge-medium hover:border-edge-strong';
const TILE_ACTIVE = 'border-accent ring-2 ring-accent/40';
const TILE_EMPTY = 'bg-surface-3 flex flex-col items-center justify-center gap-1 text-fg-faint';

const DELETE_BTN =
  'absolute top-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-xs ' +
  'bg-surface-0/80 text-fg-secondary border-none cursor-pointer p-0 ' +
  'opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100 ' +
  'hover:bg-danger hover:text-fg-on-accent ' +
  'transition-opacity duration-quick ease-standard';

const ACTIVE_BADGE =
  'absolute top-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-full ' +
  'bg-accent text-fg-on-accent pointer-events-none';

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

function uploadFailureMessage(failure: UploadUserBlobFailure): string {
  switch (failure.kind) {
    case 'unsupported-format':
      return failure.mimeType
        ? `Unsupported file type: ${failure.mimeType}`
        : 'Unsupported file type';
    case 'too-large':
      return `Image is too large (${Math.round(failure.size / 1024)}KB / max ${Math.round(failure.max / 1024)}KB)`;
    case 'quota-exceeded':
      return `You're at the asset limit (${failure.current}/${failure.limit}). Delete one before uploading another.`;
    case 'invalid-upload':
      return `The upload was rejected: ${failure.reason}`;
    case 'upload-failed':
      return `Upload failed: ${failure.reason}`;
  }
}

function deleteConfirmMessage(
  usage: ReadonlyArray<SheetStyleAssetUsage>,
  fieldLabel: string,
): string {
  if (usage.length === 0) {
    return `This asset isn't used in the current project, but it may be used in other projects of yours we can't check. Delete it?`;
  }
  const sheetNames = Array.from(new Set(usage.map((u) => u.sheetName)));
  const formatted = sheetNames.length === 1
    ? `'${sheetNames[0]}'`
    : `${sheetNames.slice(0, -1).map((n) => `'${n}'`).join(', ')} and '${sheetNames.at(-1)}'`;
  return `${fieldLabel} is in use by ${formatted}. Deleting it will reset those sheets to the template's default.`;
}

function libraryCounterLabel(count: number, cap: number | null): string {
  const suffix = count === 1 ? 'asset' : 'assets';
  if (cap === null) return `${count} ${suffix} in your library`;
  return `${count} of ${cap} ${suffix} used`;
}

/**
 * Library + picker for image-typed style controls. The grid lists
 * every asset the library exposes (built-in plus user-uploaded) and
 * lets the user upload, pick, or delete. Picking closes the dialog
 * and applies the choice; deleting goes through a confirmation that
 * warns about in-editor usage of the asset being removed. The delete
 * affordance only shows on user-source entries.
 */
export const AssetLibraryDialog = memo(function AssetLibraryDialog({
  open,
  field,
  selectedAssetId,
  findUsage,
  onPick,
  onClose,
}: AssetLibraryDialogProps) {
  const userBlobs = useUserBlobs();
  const { assets } = useAssetLibrary();
  const userAssetsCount = useMemo(
    () => assets.filter((a) => a.source === 'user').length,
    [assets],
  );

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAssetId = String(field.default);
  const isDefaultActive = selectedAssetId === defaultAssetId;

  const openFilePicker = useCallback(() => {
    setUploadError(null);
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await userBlobs.upload(file);
      if (!result.ok) setUploadError(uploadFailureMessage(result.failure));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [userBlobs]);

  const pickAsset = useCallback((asset: Asset) => {
    onPick(asset.id === defaultAssetId ? null : asset.id);
    onClose();
  }, [onPick, onClose, defaultAssetId]);

  const requestDelete = useCallback((asset: Asset) => {
    setPendingDeletion(asset);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeletion(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    const asset = pendingDeletion;
    if (!asset) return;
    setPendingDeletion(null);
    await userBlobs.delete(asset.id);
  }, [pendingDeletion, userBlobs]);

  const deletionUsage = useMemo(
    () => (pendingDeletion ? findUsage(pendingDeletion.id) : []),
    [pendingDeletion, findUsage],
  );

  return (
    <>
      <AppDialog
        open={open && pendingDeletion === null}
        onClose={onClose}
        size="lg"
        title={field.label}
        description="Pick an asset or upload your own."
        showCloseButton
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
          <button
            type="button"
            className={`${TILE_BASE} ${TILE_IDLE} ${TILE_EMPTY}`}
            onClick={openFilePicker}
            disabled={isUploading}
            aria-label={isUploading ? 'Uploading' : 'Upload a new asset'}
            aria-busy={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 size={20} strokeWidth={2} className="animate-spin" />
                <span className="text-2xs font-medium leading-none">Uploading</span>
              </>
            ) : (
              <>
                <ImagePlus size={20} strokeWidth={2} />
                <span className="text-2xs font-medium leading-none">Upload</span>
              </>
            )}
          </button>

          {assets.map((asset) => {
            const isActive = asset.id === selectedAssetId
              || (asset.id === defaultAssetId && isDefaultActive);
            const isDeletable = asset.source === 'user';
            return (
              <div key={asset.id} className="group/tile relative">
                <button
                  type="button"
                  className={`${TILE_BASE} ${isActive ? TILE_ACTIVE : TILE_IDLE} w-full`}
                  style={imageTileStyle(asset.url)}
                  onClick={() => pickAsset(asset)}
                  aria-label={asset.id === defaultAssetId ? 'Use template default' : 'Use this asset'}
                  title={asset.id === defaultAssetId ? 'Template default' : undefined}
                >
                  {isActive && (
                    <span className={ACTIVE_BADGE}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
                {isDeletable && (
                  <button
                    type="button"
                    className={DELETE_BTN}
                    onClick={(e) => { e.stopPropagation(); requestDelete(asset); }}
                    aria-label="Delete asset"
                    title="Delete asset"
                  >
                    <Trash2 size={11} strokeWidth={2.25} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={onFileChange}
        />

        {uploadError && (
          <p className="text-sm text-danger m-0" role="alert">{uploadError}</p>
        )}

        <p className="text-2xs text-fg-faint m-0">
          {libraryCounterLabel(userAssetsCount, userBlobs.capByKind['template-asset'])}
        </p>
      </AppDialog>

      <ConfirmDialog
        open={pendingDeletion !== null}
        message={pendingDeletion ? deleteConfirmMessage(deletionUsage, field.label) : ''}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
});
