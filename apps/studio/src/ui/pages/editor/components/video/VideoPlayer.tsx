import { memo, type Ref } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { VideoState } from '@core/editor/domain/VideoState';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { PreviewSourceUnavailablePanel } from '@ui/pages/editor/components/video/PreviewSourceUnavailablePanel';

interface VideoPlayerProps {
  containerRef: Ref<HTMLDivElement>;
  video: VideoState;
  onClick: () => void;
  /** Takes a freshly chosen file in place of an original that can no longer be read. */
  onSelectOriginalVideo: (file: File) => void;
}

// A media tag in the idiom of the project card's duration badge, not a
// status pill: it sits over arbitrary frames for the whole session, so
// it carries its own scrim and stays as small as legibility allows. It
// takes pointer events only so its tooltip can open; the area it covers
// is too small to matter for click-to-play on the surface below.
const LOW_RES_BADGE =
  'absolute top-2 right-2 z-10 cursor-default select-none max-lg:hidden ' +
  'font-mono text-3xs uppercase tracking-[0.06em] text-white/70 ' +
  'bg-black/50 backdrop-blur-sm px-1 py-0.5 rounded-xs';

/**
 * Renders the preview surface's host container plus the affordances
 * pinned over it: a "low res" badge when the proxy pipeline
 * is actively feeding the surface (its tooltip says the export is
 * unaffected), a spinner while the first frame is decoding or while
 * another copy of an original that stopped reading is looked for, a
 * panel to choose the file again when no copy could be found, and an
 * error panel if the source could not be played.
 * Returns a fragment so the consumer's positioned wrapper holds
 * these alongside its own overlays (subtitle, social, etc.) without
 * an extra wrapping element.
 *
 * The container is deliberately renderer-agnostic: whichever preview
 * surface variant is wired up (canvas, native `<video>`, etc.) mounts
 * its own presentation element inside on `start`, so this component
 * does not need to know which surface is active.
 */
export const VideoPlayer = memo(function VideoPlayer({ containerRef, video, onClick, onSelectOriginalVideo }: VideoPlayerProps) {
  const showLowResBadge = video.preview?.kind === 'proxy';
  const lookingForAnotherCopy = video.loadError?.reason === 'source-unreadable' && video.preview?.kind === 'original';
  const showLoadFailure = video.loadError !== null && !lookingForAnotherCopy;
  const showSpinner = (video.url !== null && !video.isReady && video.loadError === null) || lookingForAnotherCopy;
  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        onClick={onClick}
      />
      {showLowResBadge && (
        <Tooltip text="Preview only. Your export keeps full quality." position="bottom">
          <span className={LOW_RES_BADGE} tabIndex={0}>
            Low res
          </span>
        </Tooltip>
      )}
      {video.sourceUnavailable ? (
        <PreviewSourceUnavailablePanel error={video.sourceUnavailable} onSelectOriginalVideo={onSelectOriginalVideo} />
      ) : (
        <>
          {showLoadFailure && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-1 p-4 text-center pointer-events-none">
              <AlertCircle size={32} className="text-fg-faint" />
              <p className="text-sm text-fg-primary">Couldn&apos;t play your video</p>
              <p className="text-xs text-fg-faint">Your browser could not open this video.</p>
            </div>
          )}
          {showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 pointer-events-none">
              <Loader2 size={32} className="animate-spin text-fg-faint" />
            </div>
          )}
        </>
      )}
    </>
  );
});
