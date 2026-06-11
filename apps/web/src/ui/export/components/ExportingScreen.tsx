import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';

export type ExportingScreenPhase = 'running' | 'completed';

interface ExportingScreenProps {
  readonly progressStore: ExportProgressStore;
  readonly phase: ExportingScreenPhase;
}

/**
 * Splash shown for the duration of an export and for a brief confirmation
 * window after it finishes cleanly. Owns the full viewport; pause /
 * error / notice surface through a dialog on top.
 */
export function ExportingScreen({ progressStore, phase }: ExportingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-16 flex-1 w-full">
      <Wordmark size="lg" working={phase === 'running'} />

      {phase === 'running'
        ? <RunningCenter progressStore={progressStore} />
        : <CompletedCenter />}

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        {phase === 'running' ? (
          <>
            <p className="text-base text-fg-primary m-0">Burning subtitles into your video.</p>
            <p className="text-sm text-fg-muted m-0">Keep this tab open until it finishes.</p>
          </>
        ) : (
          <>
            <p className="text-base text-fg-primary m-0">Your video is ready.</p>
            <p className="text-sm text-fg-muted m-0">Saved to disk.</p>
          </>
        )}
      </div>
    </div>
  );
}

function RunningCenter({ progressStore }: { readonly progressStore: ExportProgressStore }) {
  const [percent, setPercent] = useState(() => progressStore.percent);
  const pct = Math.max(0, Math.min(100, Math.round(percent)));

  useEffect(() => {
    const update = () => setPercent(progressStore.percent);
    progressStore.addEventListener('change', update);
    update();
    return () => progressStore.removeEventListener('change', update);
  }, [progressStore]);

  return (
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
  );
}

function CompletedCenter() {
  return (
    <span
      className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-accent text-accent animate-mark-scale-in"
      aria-hidden="true"
    >
      <Check size={28} strokeWidth={2.5} />
    </span>
  );
}
