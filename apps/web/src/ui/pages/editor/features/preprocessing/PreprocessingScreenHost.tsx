import { useEffect, useMemo } from 'react';
import { TranscribeProgressController } from '@presentation/transcription/controllers/TranscribeProgressController';
import { useTranscription } from '@ui/_shared/contexts/modules/TranscriptionContext';
import { PreprocessingScreen } from '@ui/pages/editor/features/preprocessing/components/PreprocessingScreen';


/**
 * Mounts the preprocessing splash and feeds it a fresh progress
 * controller scoped to this mount. Surface-specific copy and the
 * slow-hint nudge are wired here so the screen itself stays
 * surface-agnostic.
 */
export function PreprocessingScreenHost() {
  const { progressStore } = useTranscription();
  const progressController = useMemo(
    () => new TranscribeProgressController(progressStore),
    [progressStore],
  );

  useEffect(() => {
    progressController.start();
    return () => progressController.stop();
  }, [progressController]);


  return (
    <main className="relative flex flex-col items-center justify-center h-dvh overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      <PreprocessingScreen
        controller={progressController}
      />
    </main>
  );
}

