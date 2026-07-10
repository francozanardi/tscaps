import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { PreprocessingScreen } from '@ui/pages/editor/features/preprocessing/components/PreprocessingScreen';


/**
 * Mounts the preprocessing splash and feeds it the progress store.
 * Surface-specific copy and the slow-hint nudge are wired here so the
 * screen itself stays surface-agnostic.
 */
export function PreprocessingScreenHost() {
  const { progressStore } = usePreprocessing();

  return (
    <main className="relative flex flex-col items-center justify-center h-dvh overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      <PreprocessingScreen
        store={progressStore}
      />
    </main>
  );
}

