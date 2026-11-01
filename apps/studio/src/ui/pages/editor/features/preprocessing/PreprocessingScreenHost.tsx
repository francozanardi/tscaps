import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';
import { PreprocessingScreen } from '@ui/pages/editor/features/preprocessing/components/PreprocessingScreen';
import { VideoConversionOfferDialog } from '@ui/pages/editor/features/preprocessing/components/VideoConversionOfferDialog';
import { useVideoConversionOffer } from '@ui/pages/editor/features/preprocessing/useVideoConversionOffer';


/**
 * Mounts the preprocessing splash and feeds it the progress store, or,
 * while the run offers to convert its video, the question in its place.
 * Surface-specific copy and the slow-hint nudge are wired here so the
 * screen itself stays surface-agnostic.
 */
export function PreprocessingScreenHost() {
  const { progressStore, conversionOfferStore, actions } = usePreprocessing();
  const conversionOffer = useVideoConversionOffer(conversionOfferStore);

  // The splash says what the run is doing, which is nothing while it
  // waits on the answer to the offer.
  return (
    <main className="relative flex flex-col items-center justify-center h-full overflow-hidden px-3 py-2 lg:px-6 lg:py-4">
      {conversionOffer ? (
        <VideoConversionOfferDialog
          offer={conversionOffer}
          onAccept={() => actions.acceptVideoConversion.execute()}
          onDecline={() => actions.declineVideoConversion.execute()}
        />
      ) : (
        <PreprocessingScreen
          store={progressStore}
        />
      )}
    </main>
  );
}


