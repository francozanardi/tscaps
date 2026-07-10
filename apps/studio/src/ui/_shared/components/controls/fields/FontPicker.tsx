import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { SelectOption } from '@core/templates/domain/definition/ControlField';
import { FONT_CATALOG } from '@core/fonts/domain/FontCatalog';
import type { UploadUserFontFailure } from '@core/fonts/actions/UploadUserFontAction';
import { useUserFonts } from '@ui/_shared/contexts/UserFontsContext';
import { Autocomplete, type AutocompleteGroup } from '@ui/_shared/components/Autocomplete/Autocomplete';

interface FontPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
}

/**
 * File extensions the upload button accepts. The action layer validates
 * again — this is just a hint for the OS file picker so users don't pick
 * incompatible files in the first place.
 */
const ACCEPTED_FILE_TYPES = '.woff2,.woff,.ttf,.otf';

const UPLOAD_ROW =
  'w-full h-8 px-2.5 flex items-center gap-2 text-sm text-fg-secondary cursor-pointer bg-transparent border-none ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3';
const DELETE_BTN =
  'flex items-center justify-center w-4 h-4 rounded-xs border-none bg-transparent text-fg-faint cursor-pointer p-0 ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-primary hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

function failureMessage(failure: UploadUserFontFailure): string {
  switch (failure.kind) {
    case 'unsupported-format':
      return failure.extension
        ? `Unsupported font format: .${failure.extension}`
        : 'Unsupported font format';
    case 'too-large':
      return `Font is too large (${(failure.size / 1024 / 1024).toFixed(1)}MB / max ${(failure.max / 1024 / 1024).toFixed(0)}MB)`;
    case 'duplicate-name':
      return failure.family
        ? `A font named "${failure.family}" is already uploaded`
        : 'A font with the same name is already uploaded';
    case 'empty-name':
      return 'Could not derive a name from the filename';
    case 'quota-exceeded':
      return `You're at the font limit (${failure.current}/${failure.limit}). Delete one before uploading another.`;
    case 'invalid-upload':
      return `The upload was rejected: ${failure.reason}`;
    case 'upload-failed':
      return `Upload failed: ${failure.reason}`;
  }
}

/**
 * Font-family picker that surfaces both the user's uploaded fonts and the
 * curated Library catalog as two groups in a single dropdown. The dropdown
 * always carries an "Upload custom font" CTA pinned at the top — visible
 * regardless of whether the user has any uploads yet — so the entry point
 * is discoverable without forcing an empty "My fonts" header. The
 * "My fonts" group itself only renders once the user has uploaded at
 * least one font; each user-font row exposes a delete affordance on hover.
 */
export const FontPicker = memo(function FontPicker({ value, onChange, disabled }: FontPickerProps) {
  const userFonts = useUserFonts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onUploadClick = useCallback(() => {
    if (isUploading) return;
    setErrorMessage(null);
    fileInputRef.current?.click();
  }, [isUploading]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await userFonts.upload(file);
      if (!result.ok) setErrorMessage(failureMessage(result.failure));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [userFonts]);

  const onDeleteClick = useCallback((id: string) => {
    void userFonts.delete(id);
  }, [userFonts]);

  const groups = useMemo<ReadonlyArray<AutocompleteGroup<SelectOption>>>(() => {
    const myFontsOptions: SelectOption[] = userFonts.fonts.map((f) => ({
      value: f.family,
      label: f.family,
      cssValue: `'${f.family}'`,
    }));
    const familyToId = new Map(userFonts.fonts.map((f) => [f.family, f.id] as const));

    const renderOptionAction = (opt: SelectOption) => {
      const id = familyToId.get(opt.value);
      if (id === undefined) return null;
      return (
        <button
          type="button"
          title="Delete font"
          aria-label={`Delete ${opt.label}`}
          className={DELETE_BTN}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick(id);
          }}
        >
          <Trash2 size={11} strokeWidth={2.25} />
        </button>
      );
    };

    const result: AutocompleteGroup<SelectOption>[] = [];
    if (myFontsOptions.length > 0) {
      result.push({
        id: 'my-fonts',
        label: 'My fonts',
        options: myFontsOptions,
        renderOptionAction,
      });
    }
    result.push({
      id: 'library',
      label: 'Library',
      options: FONT_CATALOG,
    });
    return result;
  }, [userFonts.fonts, onDeleteClick]);

  const uploadHeader = (
    <button
      type="button"
      className={UPLOAD_ROW}
      onMouseDown={(e) => { e.preventDefault(); onUploadClick(); }}
      disabled={isUploading}
      aria-busy={isUploading}
    >
      {isUploading ? (
        <Loader2 size={14} strokeWidth={2.25} className="text-accent animate-spin" />
      ) : (
        <Plus size={14} strokeWidth={2.25} className="text-accent" />
      )}
      <span className="flex-1 text-left">
        {isUploading ? 'Uploading font…' : 'Upload custom font'}
      </span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col gap-1 min-w-0">
      <Autocomplete
        groups={groups}
        header={uploadHeader}
        value={value}
        onChange={onChange}
        disabled={disabled}
        renderOption={(opt) => (
          <span style={{ fontFamily: opt.cssValue ?? opt.value }}>{opt.label}</span>
        )}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={onFileChange}
      />
      {errorMessage && (
        <span className="text-2xs text-danger truncate" role="alert" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </div>
  );
});
