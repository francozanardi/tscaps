import { memo, type Ref } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { VideoState } from '@core/editor/domain/VideoState';

interface VideoPlayerProps {
  videoRef: Ref<HTMLVideoElement>;
  video: VideoState;
  onClick: () => void;
}

/**
 * Renders the `<video>` element plus the load-state affordances pinned over
 * it: a spinner while the first frame is decoding and an error panel if the
 * browser failed to load the source. Returns a fragment so the consumer's
 * positioned container holds these alongside its own overlays (subtitle,
 * social, etc.) without an extra wrapper.
 */
export const VideoPlayer = memo(function VideoPlayer({ videoRef, video, onClick }: VideoPlayerProps) {
  return (
    <>
      {/* Overdraws 1px past each edge to mask a sub-pixel gap between the video
          raster and the parent's clip box when the container resolves to a
          fractional size; the parent's `overflow-hidden` trims the overflow. */}
      <video
        ref={videoRef}
        src={video.url ?? ''}
        className="w-[calc(100%+2px)] h-[calc(100%+2px)] -m-px max-w-none max-h-none object-contain"
        playsInline
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
