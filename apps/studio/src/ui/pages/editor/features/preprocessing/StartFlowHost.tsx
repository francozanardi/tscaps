import { useMemo } from 'react';
import type { VideoRejectionDetails } from '@core/videos/domain/VideoValidationResult';
import { useAnalysisDeadline, type AnalysisPhase } from '@ui/pages/editor/features/preprocessing/useAnalysisDeadline';
import { useVideoValidation } from '@ui/pages/editor/features/preprocessing/useVideoValidation';
import { useVideos } from '@ui/_shared/contexts/modules/VideosContext';
import { useTranscription } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { WHISPER_SUPPORTED_LANGUAGES, type SupportedLanguage } from '@shared/transcription-languages';
import { StartDialog } from '@ui/pages/editor/features/preprocessing/StartDialog';
import { UnreadableVideoNotice } from '@ui/pages/editor/features/preprocessing/components/UnreadableVideoNotice';
import { NoAudioTrackNotice } from '@ui/pages/editor/features/preprocessing/components/NoAudioTrackNotice';
import { LongVideoWarning } from '@ui/pages/editor/features/preprocessing/components/LongVideoWarning';
import type { EditorState } from '@core/editor/domain/EditorState';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useStartFlowGate } from '@ui/_shared/hooks/useStartFlowGate';

interface StartFlowHostProps {
  onBack: () => void;
}


/**
 * Hosts the start-video dialog. Listens to the derived `dialogOpen`
 * flag and mounts the dialog only while it is true. Cancel composes
 * "clear the loaded video" with the navigation callback supplied by
 * the route so the user lands back where the flow started.
 */
export function StartFlowHost({ onBack }: StartFlowHostProps) {
  const videos = useVideos();
  const transcription = useTranscription();
  const preprocessing = usePreprocessing();
  const { userAgentInspector } = useUtils();
  const open = useStartFlowGate();
  const state = useEditorState();
  const languagesBase = WHISPER_SUPPORTED_LANGUAGES;
  const ranked = useMemo(
    () => preprocessing.languageRanker.rank(languagesBase),
    [preprocessing.languageRanker, languagesBase],
  );

  // Asked only while the start flow is in charge: a video the editor
  // merely holds is not up for transcription.
  const candidate = useMemo(
    () => (open && state.video.file !== null && !state.video.isProbing
      ? { durationSeconds: state.video.duration, isSourceReadable: state.video.isSourceReadable }
      : null),
    [open, state.video.file, state.video.isProbing, state.video.duration, state.video.isSourceReadable],
  );
  const validation = useVideoValidation(
    preprocessing.videoValidator,
    candidate,
  );
  const analysisPhase = resolveAnalysisPhase(open, state.video, validation.isValidating);
  const timedOut = useAnalysisDeadline(analysisPhase);
  const isAnalyzing = analysisPhase !== null && timedOut === null;
  const ruledOut: VideoRejectionDetails | null = validation.result?.state === 'rejected'
    ? validation.result.details
    : null;
  const rejection = ruledOut ?? (timedOut === 'probing' ? SOURCE_NEVER_ANSWERED : null);

  if (!open) return null;

  const handleCancel = () => {
    videos.actions.clear.execute();
    onBack();
  };

  const unreadable = rejection?.type === 'unreadable' ? rejection : null;
  const startDisabled = isAnalyzing || rejection !== null;
  const isMobile = userAgentInspector.isMobile();
  const videoDurationSeconds = state.video.duration;
  const recordLanguagePick = (language: SupportedLanguage) =>
    preprocessing.languageUsageRepository.recordPick(language);

  const validationNotices = (
    <>
      {unreadable && <UnreadableVideoNotice reason={unreadable.reason} />}
      {state.video.hasAudioTrack === false && <NoAudioTrackNotice />}
    </>
  );


  return (
    <StartDialog
      open
      preference={state.transcribePreference}
      isMobileDevice={userAgentInspector.isMobile()}
      error={state.error}
      preprocessVideo={preprocessing.actions.preprocessVideo}
      updatePreference={transcription.actions.updatePreference}
      onCancel={handleCancel}
      startDisabled={startDisabled}
      startPending={isAnalyzing}
      languages={ranked.languages}
      mostUsedCode={ranked.mostUsedCode}
      lastUsedCode={ranked.lastUsedCode}
      onLanguagePicked={recordLanguagePick}
      extraNotices={
        <>
          {validationNotices}
          <LongVideoWarning
            videoDurationSeconds={videoDurationSeconds}
            isMobile={isMobile}
          />
        </>
      }
    />
  );
}


/**
 * A probe that never answered means the file's bytes never came back
 * from the device. That is the same dead end as a source the runtime
 * refused outright, and it asks the visitor for the same thing.
 */
const SOURCE_NEVER_ANSWERED: VideoRejectionDetails = {
  type: 'unreadable',
  reason: 'source-unreadable',
};

function resolveAnalysisPhase(
  open: boolean,
  video: EditorState['video'],
  isValidating: boolean,
): AnalysisPhase | null {
  if (!open || video.file === null) return null;
  if (video.isProbing) return 'probing';
  return isValidating ? 'validating' : null;
}
