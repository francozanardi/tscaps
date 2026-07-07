import { memo, type Ref } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { VideoState } from '@core/editor/domain/VideoState';

interface VideoPlayerProps {
  canvasRef: Ref<HTMLCanvasElement>;
  video: VideoState;
  onClick: () => void;
}

/**
 * Renders the preview `<canvas>` plus the load-state affordances
 * pinned over it: a spinner while the first frame is decoding and
 * an error panel if the source failed to open. Returns a fragment
 * so the consumer's positioned container holds these alongside
 * its own overlays (subtitle, social, etc.) without an extra
 * wrapper.
 */
export const VideoPlayer = memo(function VideoPlayer({ canvasRef, video, onClick }: VideoPlayerProps) {
  return (
    <>
      <canvas
        ref={canvasRef}
        className="w-[calc(100%+2px)] h-[calc(100%+2px)] -m-px max-w-none max-h-none"
        onClick={onClick}
      />
      {video.url && video.loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-1 p-4 text-center pointer-events-none">
          <AlertCircle size={32} className="text-fg-faint" />
          <p className="text-sm text-fg-primary">Video failed to load</p>
          <p className="text-xs text-fg-faint">
            {labelForLoadErrorCode(video.loadError.code)}
            {video.loadError.message ? ` — ${video.loadError.message}` : ''}
          </p>
        </div>
      )}
      {video.url && !video.isReady && !video.loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-1 pointer-events-none">
          <Loader2 size={32} className="animate-spin text-fg-faint" />
        </div>
      )}
    </>
  );
});

/** Maps `MediaError.code` to a short human label. */
function labelForLoadErrorCode(code: number): string {
  switch (code) {
    case 1: return 'Loading was aborted';
    case 2: return 'Network error';
    case 3: return 'Decoding failed';
    case 4: return 'Format not supported';
    default: return `Unknown error (code ${code})`;
  }
}
