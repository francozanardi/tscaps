import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import type { SelectOption } from '@core/templates/domain/definition/ControlField';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { SYSTEM_FONT_FAMILIES } from '@core/fonts/domain/SystemFontFamily';
import type { UploadUserFontFailure } from '@core/fonts/actions/UploadUserFontAction';
import { useUserFonts } from '@ui/_shared/contexts/UserFontsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { Autocomplete, type AutocompleteGroup } from '@ui/_shared/components/Autocomplete/Autocomplete';
import { SCRIPT_LABELS } from '@ui/_shared/components/controls/fields/ScriptLabels';

interface FontPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  /** The writing system this pick has to draw. Only the families that fit it are offered. */
  forScript: FontFaceSlot;
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
 * Picks the face that draws one writing system, offering the catalog
 * families that fit it and every font the user uploaded.
 *
 * Uploads are offered whatever the script: what an uploaded face covers
 * is unknowable, and refusing the reader their own font on a guess is
 * worse than letting them see for themselves that it does not draw.
 *
 * The dropdown always carries an "Upload custom font" CTA pinned at the
 * top — visible whether or not the user has uploads yet — so the entry
 * point is discoverable without forcing an empty "My fonts" header. Each
 * user-font row exposes a delete affordance on hover.
 */
export const FontPicker = memo(function FontPicker({ value, onChange, disabled, forScript }: FontPickerProps) {
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

  const { scriptFamilyResolver } = useRendering();
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

    // A row previews the family by rendering in it, which tells a reader
    // nothing about a face they will only ever use for another script:
    // "Cairo" spelled in Latin shows Cairo's Latin. Non-Latin rows carry
    // a short sample so what the captions will look like is on screen.
    const label = SCRIPT_LABELS[forScript];
    const options = forScript === 'other'
      ? SYSTEM_FONT_FAMILIES.map((family) => ({
        value: family,
        label: family === 'sans-serif' ? 'Sans serif' : family === 'serif' ? 'Serif' : 'Monospace',
        cssValue: family,
        sample: '',
      }))
      : scriptFamilyResolver.resolve(forScript).map((family) => ({
        value: family,
        label: family.replace(/\s+Variable$/, ''),
        cssValue: `'${family}'`,
        sample: forScript === 'latin' ? '' : label.sample,
      }));
    if (options.length > 0) result.push({ id: forScript, label: label.name, options });
    return result;
  }, [userFonts.fonts, onDeleteClick, scriptFamilyResolver, forScript]);

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
          <span className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
            <span className="truncate" style={{ fontFamily: opt.cssValue ?? opt.value }}>{opt.label}</span>
            {'sample' in opt && typeof opt.sample === 'string' && opt.sample !== '' && (
              <span
                dir="auto"
                className="shrink-0 text-fg-muted"
                style={{ fontFamily: opt.cssValue ?? opt.value }}
              >
                {opt.sample}
              </span>
            )}
          </span>
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
