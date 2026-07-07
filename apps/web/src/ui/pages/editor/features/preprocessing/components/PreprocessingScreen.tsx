import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PreprocessingProgressStatus } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';

export interface Copy {
  readonly primary: string;
  readonly helper: string;
}

export type CopyResolver = (status: PreprocessingProgressStatus) => Copy;

interface PreprocessingScreenProps {
  readonly store: PreprocessingProgressStore;
  readonly selectCopy?: CopyResolver;
}

const defaultSelectCopy: CopyResolver = (status) => {
  if (status.phase === 'model-download') {
    return {
      primary: 'Downloading the model.',
      helper: 'First run only — the model is cached after this.',
    };
  }
  if (status.phase === 'preview-proxy') {
    return {
      primary: 'Preparing the editor preview.',
      helper: 'Re-encoding your video so playback stays smooth.',
    };
  }
  return {
    primary: 'Transcribing your video in this browser.',
    helper: 'Keep this tab open until it finishes.',
  };
};

function useProgressStatus(store: PreprocessingProgressStore): PreprocessingProgressStatus {
  const [status, setStatus] = useState<PreprocessingProgressStatus>(() => store.status);
  useEffect(() => {
    const update = () => setStatus(store.status);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return status;
}

/**
 * Splash shown while the preprocessing pipeline runs. Owns the full
 * viewport until the surrounding shell flips off the `preprocessing`
 * branch. Each phase reports its own `[0, 1]` progress; `inferring`
 * has no real progress signal from the server, so it shows a spinner
 * instead of a bar. The optional copy resolver lets the host override
 * the primary/helper strings per surface.
 */
export function PreprocessingScreen({
  store,
  selectCopy = defaultSelectCopy,
}: PreprocessingScreenProps) {
  const status = useProgressStatus(store);
  const { primary, helper } = selectCopy(status);

  return (
    <div className="flex flex-col items-center justify-center gap-16 flex-1 w-full">
      <Wordmark size="lg" working />

      <div className="flex flex-col items-center gap-4 w-full max-w-md min-h-14 justify-center">
        {status.phase === 'inferring'
          ? <Loader2 size={48} className="animate-spin text-fg-faint" />
          : <PhaseProgressBar rawProgress={status.rawProgress} />}
      </div>

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <p className="text-base text-fg-primary m-0">{primary}</p>
        <p className="text-sm text-fg-muted m-0">{helper}</p>
      </div>
    </div>
  );
}

function PhaseProgressBar({ rawProgress }: { rawProgress: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(rawProgress * 100)));
  return (
    <>
      <span className="font-mono text-4xl text-fg-primary tabular-nums">{pct}%</span>
      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
        {/* `transform: scaleX` avoids layout/paint on each tick — composite-only. */}
        <div
          className="h-full w-full bg-accent origin-left transition-transform duration-base ease-emphasized"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </>
  );
}
