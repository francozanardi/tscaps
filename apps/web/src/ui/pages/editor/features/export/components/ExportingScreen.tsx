import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { ExportProgressStore } from '@core/export/store/ExportProgressStore';
import type { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { OriginalVideoDownloadStatus } from '@core/projects/domain/OriginalVideoDownloadStatus';
import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';

export type ExportingScreenPhase = 'awaiting-original' | 'running' | 'completed';

interface ExportingScreenProps {
  readonly progressStore: ExportProgressStore;
  readonly downloadStore: OriginalVideoDownloadStore;
  readonly phase: ExportingScreenPhase;
}

/**
 * Splash shown for the duration of an export, plus the upstream
 * original-video download when the bytes were not yet available at
 * the moment the user pressed Export, and a brief confirmation
 * window after a clean finish. Owns the full viewport; pause /
 * error / notice surface through a dialog on top.
 */
export function ExportingScreen({ progressStore, downloadStore, phase }: ExportingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-16 flex-1 w-full">
      <Wordmark size="lg" working={phase !== 'completed'} />

      {phase === 'awaiting-original' && <DownloadingOriginalCenter downloadStore={downloadStore} />}
      {phase === 'running' && <RunningCenter progressStore={progressStore} />}
      {phase === 'completed' && <CompletedCenter />}

      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <ExportingScreenCopy phase={phase} />
      </div>
    </div>
  );
}

function ExportingScreenCopy({ phase }: { readonly phase: ExportingScreenPhase }) {
  if (phase === 'awaiting-original') {
    return (
      <>
        <p className="text-base text-fg-primary m-0">Fetching your original video.</p>
        <p className="text-sm text-fg-muted m-0">We need the source bytes before rendering can start.</p>
      </>
    );
  }
  if (phase === 'running') {
    return (
      <>
        <p className="text-base text-fg-primary m-0">Burning subtitles into your video.</p>
        <p className="text-sm text-fg-muted m-0">Keep this tab open until it finishes.</p>
      </>
    );
  }
  return (
    <>
      <p className="text-base text-fg-primary m-0">Your video is ready.</p>
      <p className="text-sm text-fg-muted m-0">Saved to disk.</p>
    </>
  );
}

function RunningCenter({ progressStore }: { readonly progressStore: ExportProgressStore }) {
  const [percent, setPercent] = useState(() => progressStore.percent);
  const pct = clampPercent(Math.round(percent));

  useEffect(() => {
    const update = () => setPercent(progressStore.percent);
    progressStore.addEventListener('change', update);
    update();
    return () => progressStore.removeEventListener('change', update);
  }, [progressStore]);

  return <PercentProgress percent={pct} indeterminate={false} />;
}

function DownloadingOriginalCenter({ downloadStore }: { readonly downloadStore: OriginalVideoDownloadStore }) {
  const status = useDownloadStatus(downloadStore);
  const progress = downloadingProgress(status);
  const pct = progress === null ? 0 : clampPercent(Math.round(progress * 100));
  return <PercentProgress percent={pct} indeterminate={progress === null} />;
}

function useDownloadStatus(downloadStore: OriginalVideoDownloadStore): OriginalVideoDownloadStatus {
  const [status, setStatus] = useState<OriginalVideoDownloadStatus>(() => downloadStore.status);
  useEffect(() => {
    const update = () => setStatus(downloadStore.status);
    downloadStore.addEventListener('change', update);
    update();
    return () => downloadStore.removeEventListener('change', update);
  }, [downloadStore]);
  return status;
}

function downloadingProgress(status: OriginalVideoDownloadStatus): number | null {
  if (status.kind !== 'downloading') return null;
  return status.progress;
}

function PercentProgress({ percent, indeterminate }: { readonly percent: number; readonly indeterminate: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <span className="font-mono text-4xl text-fg-primary tabular-nums">
        {indeterminate ? '…' : `${percent}%`}
      </span>
      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
        {/* `transform: scaleX` avoids layout/paint on each tick — composite-only. */}
        <div
          className="h-full w-full bg-accent origin-left transition-transform duration-base ease-emphasized"
          style={{ transform: `scaleX(${indeterminate ? 0.2 : percent / 100})` }}
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

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
