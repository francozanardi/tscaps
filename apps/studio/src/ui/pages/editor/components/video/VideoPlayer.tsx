import { memo, type Ref } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { VideoState } from '@core/editor/domain/VideoState';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';

interface VideoPlayerProps {
  containerRef: Ref<HTMLDivElement>;
  video: VideoState;
  onClick: () => void;
}

/**
 * Renders the preview surface's host container plus the affordances
 * pinned over it: a "low res preview" badge when the proxy pipeline
 * is actively feeding the surface, a spinner while the first frame
 * is decoding, and an error panel if the source failed to open.
 * Returns a fragment so the consumer's positioned wrapper holds
 * these alongside its own overlays (subtitle, social, etc.) without
 * an extra wrapping element.
 *
 * The container is deliberately renderer-agnostic: whichever preview
 * surface variant is wired up (canvas, native `<video>`, etc.) mounts
 * its own presentation element inside on `start`, so this component
 * does not need to know which surface is active.
 */
export const VideoPlayer = memo(function VideoPlayer({ containerRef, video, onClick }: VideoPlayerProps) {
  const { proxyPipelineEnabled } = usePreview();
  const showLowResBadge = proxyPipelineEnabled && video.previewFile !== null;
  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        onClick={onClick}
      />
      {showLowResBadge && (
        <StatusPill
          label="Low res preview"
          tone="subtle"
          className="absolute top-2 right-2 z-10 pointer-events-none"
        />
      )}
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
