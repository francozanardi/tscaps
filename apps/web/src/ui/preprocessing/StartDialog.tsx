import { useState, type ReactNode } from 'react';
import type { TranscriberOptions } from '@tscaps/engine';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import type { AppError } from '@core/_shared/domain/AppError';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import type { UpdateTranscribePreferenceAction } from '@core/transcription/actions/UpdateTranscribePreferenceAction';
import { SelectField, type SelectFieldOption } from '@ui/preprocessing/components/SelectField';
import { AdvancedSection } from '@ui/preprocessing/components/AdvancedSection';

const LANGUAGES: readonly SelectFieldOption[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en',   label: 'English' },
  { value: 'es',   label: 'Spanish' },
  { value: 'pt',   label: 'Portuguese' },
  { value: 'fr',   label: 'French' },
  { value: 'de',   label: 'German' },
  { value: 'it',   label: 'Italian' },
  { value: 'nl',   label: 'Dutch' },
  { value: 'ru',   label: 'Russian' },
  { value: 'ja',   label: 'Japanese' },
  { value: 'zh',   label: 'Chinese' },
  { value: 'ko',   label: 'Korean' },
  { value: 'ar',   label: 'Arabic' },
  { value: 'hi',   label: 'Hindi' },
];

const DEFAULT_DESCRIPTION = 'Pick a language. Transcription runs in your browser.';

interface StartDialogProps {
  readonly open: boolean;
  readonly preference: TranscribePreference;
  readonly isMobileDevice: boolean;
  readonly error: AppError | null;
  readonly preprocessVideo: PreprocessVideoAction;
  readonly updatePreference: UpdateTranscribePreferenceAction;
  readonly onCancel: () => void;
  readonly description?: string;
  readonly extraFields?: ReactNode;
  readonly extraNotices?: ReactNode;
  readonly renderActions?: (start: () => void) => ReactNode;
}

/**
 * Shared "Start your video" dialog. Holds the language and advanced
 * panel state internally; the optional slots let callers extend the
 * form with extra fields (e.g. a multi-speaker toggle), extra notices
 * (e.g. a duration cap warning), or a custom action row.
 */
export function StartDialog({
  open,
  preference,
  isMobileDevice,
  error,
  preprocessVideo,
  updatePreference,
  onCancel,
  description,
  extraFields,
  extraNotices,
  renderActions,
}: StartDialogProps) {
  const [language, setLanguage] = useState<string>('auto');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleStart = () => {
    const transcriber: TranscriberOptions = language === 'auto' ? {} : { language };
    void preprocessVideo.execute({ transcriber, multipleSpeakers: false });
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      closeOnOutsideClick={false}
      size="md"
      title="Start your video"
      description={description ?? DEFAULT_DESCRIPTION}
    >
      <SelectField
        id="td-language"
        label="Language"
        value={language}
        options={LANGUAGES}
        onChange={setLanguage}
      />

      {extraFields}

      <AdvancedSection
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((v) => !v)}
        preference={preference}
        onPreferenceChange={(pref) => updatePreference.execute(pref)}
      />

      {isMobileDevice && (
        <p className="text-2xs text-fg-faint m-0 leading-snug">
          In-browser transcription runs on your device — on mobile it can be slow or fail.
        </p>
      )}

      {extraNotices}

      {error && (
        <div
          role="alert"
          className="text-sm text-danger bg-danger/10 border border-danger/40 rounded-xs px-3 py-2 space-y-1"
        >
          <p className="font-semibold m-0">{getAppErrorTitle(error)}</p>
          <div className="text-fg-secondary">
            <AppErrorMessage error={error} isMobile={isMobileDevice} />
          </div>
        </div>
      )}

      <AppDialogActions>
        {renderActions
          ? renderActions(handleStart)
          : (
            <>
              <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
              <button type="button" className={BTN_PRIMARY_SM} onClick={handleStart} autoFocus>Start</button>
            </>
          )}
      </AppDialogActions>
    </AppDialog>
  );
}
