import { useState, type ReactNode } from 'react';
import type { TranscriberOptions } from '@tscaps/engine';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { AsyncButton } from '@ui/_shared/components/AsyncButton/AsyncButton';
import { Loader2 } from 'lucide-react';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import type { AppError } from '@core/errors/domain/AppError';
import { WHISPER_SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/transcription-languages';
import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import type { PreprocessVideoAction } from '@core/preprocessing/actions/PreprocessVideoAction';
import type { UpdateTranscribePreferenceAction } from '@core/transcription/actions/UpdateTranscribePreferenceAction';
import {
  LanguagePicker,
  AUTO_DETECT_LANGUAGE_VALUE,
} from '@ui/_shared/components/LanguagePicker/LanguagePicker';
import { AdvancedSection } from '@ui/pages/editor/features/preprocessing/components/AdvancedSection';

const DEFAULT_DESCRIPTION = 'Pick a language. Transcription runs in your browser.';

interface StartDialogProps {
  readonly open: boolean;
  readonly preference: TranscribePreference;
  readonly isMobileDevice: boolean;
  readonly error: AppError | null;
  readonly preprocessVideo: PreprocessVideoAction;
  readonly updatePreference: UpdateTranscribePreferenceAction;
  readonly onCancel: () => void;
  /** Disables the default Start action while the loaded video is not accepted yet. */
  readonly startDisabled?: boolean;
  /** Draws a spinner on the default Start action while the flow is still deciding. */
  readonly startPending?: boolean;
  readonly description?: string;
  readonly extraFields?: ReactNode;
  readonly extraNotices?: ReactNode;
  readonly renderActions?: (start: () => Promise<void>) => ReactNode;
  /** Whether the transcriber runs in the browser. */
  readonly inBrowserTranscription?: boolean;
  /**
   * Languages offered by the transcriber this dialog is starting. Defaults
   * to the Whisper list, matching the default in-browser transcriber.
   */
  readonly languages?: readonly SupportedLanguage[];
  /**
   * Adds an "Auto-detect" first row to the language picker and uses it as
   * the initial value. Off by default: the in-browser Whisper transcriber
   * silently falls back to English when nothing is picked, so we require
   * an explicit choice there. Callers whose transcriber can detect the
   * language from the audio turn this on.
   */
  readonly allowAutoDetect?: boolean;
  /**
   * Surface code of the user's most-picked language across sessions.
   * The matching entry in `languages` gets a "Most used" hint (or
   * only "Last used" when it coincides with `lastUsedCode`). Callers
   * are expected to have moved this language to the top of the list.
   */
  readonly mostUsedCode?: string | null;
  /**
   * Surface code of the user's last-picked language. The matching
   * entry gets a "Last used" hint. Callers are expected to have moved
   * this language near the top of the list.
   */
  readonly lastUsedCode?: string | null;
  /**
   * Fires when the user commits an explicit language (not auto-detect,
   * not empty) via Start. Receives the full catalog entry so the
   * caller can persist a usage signal keyed by whichever identity it
   * prefers without exposing the storage layer to this component.
   */
  readonly onLanguagePicked?: (language: SupportedLanguage) => void;
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
  startDisabled = false,
  startPending = false,
  description,
  extraFields,
  extraNotices,
  renderActions,
  inBrowserTranscription = true,
  languages = WHISPER_SUPPORTED_LANGUAGES,
  allowAutoDetect = false,
  mostUsedCode = null,
  lastUsedCode = null,
  onLanguagePicked,
}: StartDialogProps) {
  const [language, setLanguage] = useState<string>(allowAutoDetect ? AUTO_DETECT_LANGUAGE_VALUE : '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  const handleLanguageChange = (next: string) => {
    setLanguage(next);
    if (languageError !== null) setLanguageError(null);
  };

  const handleStart = async (): Promise<void> => {
    if (!allowAutoDetect && language === '') {
      setLanguageError('Please pick a language.');
      document.getElementById('td-language')?.focus();
      return;
    }
    const isExplicit = language !== '' && language !== AUTO_DETECT_LANGUAGE_VALUE;
    const transcriber: TranscriberOptions = isExplicit ? { language } : {};
    const picked = isExplicit ? languages.find((l) => l.code === language) : undefined;
    if (picked !== undefined) onLanguagePicked?.(picked);
    return preprocessVideo.execute({
      transcriber,
      multipleSpeakers: false,
      ...(picked ? { language: picked } : {}),
    });
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
      <LanguagePicker
        id="td-language"
        label="Language"
        languages={languages}
        value={language}
        onChange={handleLanguageChange}
        allowAutoDetect={allowAutoDetect}
        mostUsedCode={mostUsedCode}
        lastUsedCode={lastUsedCode}
        placeholder="Select a language"
        errorMessage={languageError ?? undefined}
      />

      {extraFields}

      {inBrowserTranscription && (
        <AdvancedSection
          open={advancedOpen}
          onToggle={() => setAdvancedOpen((v) => !v)}
          preference={preference}
          onPreferenceChange={(pref) => updatePreference.execute(pref)}
        />
      )}

      {inBrowserTranscription && isMobileDevice && (
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
              <AsyncButton
                data-testid="start-flow-primary"
                className={BTN_PRIMARY_SM}
                onClick={handleStart}
                disabled={startDisabled}
                autoFocus
              >
                {startPending && <Loader2 size={12} className="animate-spin" />}
                Start
              </AsyncButton>
            </>
          )}
      </AppDialogActions>
    </AppDialog>
  );
}
