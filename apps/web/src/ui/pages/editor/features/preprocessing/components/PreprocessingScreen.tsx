import { useEffect, useState } from 'react';
import type {
  TranscribeProgressController,
  TranscribeProgressView,
} from '@presentation/transcription/controllers/TranscribeProgressController';
import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';

export interface Copy {
  readonly primary: string;
  readonly helper: string;
}

export type CopyResolver = (view: TranscribeProgressView) => Copy;

interface PreprocessingScreenProps {
  readonly controller: TranscribeProgressController;
  readonly selectCopy?: CopyResolver;
}

const defaultSelectCopy: CopyResolver = (view) => {
  if (view.phase === 'model-download') {
    return {
      primary: 'Downloading the model.',
      helper: 'First run only — the model is cached after this.',
    };
  }
  return {
    primary: 'Transcribing your video in this browser.',
    helper: 'Keep this tab open until it finishes.',
  };
};

function useProgressView(controller: TranscribeProgressController): TranscribeProgressView {
  const [view, setView] = useState<TranscribeProgressView>(() => controller.view);
  useEffect(() => {
    const update = () => setView(controller.view);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return view;
}

/**
 * Splash shown while the preprocessing pipeline runs. Owns the full
 * viewport until the surrounding shell flips off the `preprocessing`
 * branch. The optional copy resolver lets the host override the
 * primary/helper strings when the pipeline has surface-specific stages
 * that warrant their own message.
 */
export function PreprocessingScreen({
  controller,
  selectCopy = defaultSelectCopy,
}: PreprocessingScreenProps) {
  const view = useProgressView(controller);
  const pct = Math.max(0, Math.min(100, Math.round(view.percent * 100)));
  const { primary, helper } = selectCopy(view);

  return (
    <div className="flex flex-col items-center justify-center gap-16 flex-1 w-full">
      <Wordmark size="lg" working />

      <div className="flex flex-col items-center gap-4 w-full max-w-md">
        <span className="font-mono text-4xl text-fg-primary tabular-nums">{pct}%</span>
        <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
          {/* `transform: scaleX` avoids layout/paint on each tick — composite-only. */}
          <div
            className="h-full w-full bg-accent origin-left transition-transform duration-base ease-emphasized"
            style={{ transform: `scaleX(${pct / 100})` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <p className="text-base text-fg-primary m-0">{primary}</p>
        <p className="text-sm text-fg-muted m-0">{helper}</p>
      </div>
    </div>
  );
}
