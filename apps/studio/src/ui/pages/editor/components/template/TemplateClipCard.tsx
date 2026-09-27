import { memo, useCallback, useRef, useState } from 'react';
import { Check, Star } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import { TemplateNewBadge } from '@ui/pages/editor/components/template/TemplateNewBadge';

interface TemplateClipCardProps {
  template: Template;
  /** Sample with this template's captions already burned in. */
  clipUrl: string;
  /**
   * Frame the card rests on, chosen rather than taken — a clip's first
   * frame often lands before its captions are on screen.
   */
  posterUrl: string;
  /**
   * `object-position` for the clip and its poster. A 4:5 card shows
   * 70% of a 9:16 sample's height, and which 70% decides whether the
   * captions survive.
   */
  objectPosition: string;
  isSelected: boolean;
  isFavorite: boolean;
  /** Recently added to the gallery; the card carries a "New" mark. */
  isNew: boolean;
  onSelect: (template: Template) => void;
  onToggleFavorite: (templateId: string) => void;
}

// A clip card carries a decoder where a tile carries a DOM subtree, so a
// gallery of them reaches the OOM ceiling on low-memory mobile sooner.
// The browser skips render — and the decode — for cards outside the
// viewport; the intrinsic size holds the scrollbar until first paint.
const OFFSCREEN_RENDER_SKIP_CLASS = '[content-visibility:auto] [contain-intrinsic-size:auto_140px]';

const FRAME_BASE =
  'relative w-full aspect-[4/5] bg-surface-2 rounded-md overflow-hidden cursor-pointer p-0 block ' +
  'border-[1.5px] transition-colors duration-quick ease-standard focus-visible:outline-none';

const MEDIA_LAYER = 'absolute inset-0 w-full h-full object-cover';
// The wrapper's `content-visibility` brings `contain: paint` with it,
// which clips to a rectangle, so a ring drawn outside the frame comes
// back with square corners. Focus draws its ring inside instead.
const FRAME_SELECTED = 'border-accent';
const FRAME_IDLE =
  'border-edge-subtle hover:border-edge-strong focus-visible:border-accent ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40';

const ACTIVE_BADGE =
  'absolute bottom-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-full ' +
  'bg-accent text-fg-on-accent pointer-events-none';

/**
 * Gallery card for a family whose look does not survive being shown as
 * a caption on its own. Holds a muted sample that runs while the pointer
 * is over the card and rewinds when it leaves, so a still frame is what
 * the gallery costs at rest.
 */
export const TemplateClipCard = memo(function TemplateClipCard({
  template,
  clipUrl,
  posterUrl,
  objectPosition,
  isSelected,
  isFavorite,
  isNew,
  onSelect,
  onToggleFavorite,
}: TemplateClipCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // The still is an element of its own rather than the video's `poster`,
  // which is shown only until the clip has a frame of its own and never
  // comes back after that. Rewinding lands on frame zero, not on the
  // still, so at rest the card would keep whatever the clip opens with.
  const [isRunning, setIsRunning] = useState(false);

  const startPlayback = useCallback(() => {
    // Rejects when the element is torn down mid-gesture, which is not a
    // failure worth surfacing — the card is already gone.
    void videoRef.current?.play().catch(() => {});
  }, []);

  const stopPlayback = useCallback(() => {
    setIsRunning(false);
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, []);

  // Nothing is buffered until the pointer arrives, so the still has to
  // hold until real frames exist — hiding it on hover would show the
  // empty frame for as long as the clip takes to arrive.
  const onRunning = useCallback(() => setIsRunning(true), []);

  return (
    <div
      className={`relative group/card ${OFFSCREEN_RENDER_SKIP_CLASS}`}
      onMouseEnter={startPlayback}
      onMouseLeave={stopPlayback}
    >
      <button
        type="button"
        className={`${FRAME_BASE} ${isSelected ? FRAME_SELECTED : FRAME_IDLE}`}
        onClick={() => onSelect(template)}
        onFocus={startPlayback}
        onBlur={stopPlayback}
        aria-label={template.metadata.name}
        aria-pressed={isSelected}
      >
        <video
          ref={videoRef}
          className={MEDIA_LAYER}
          style={{ objectPosition }}
          src={clipUrl}
          muted
          loop
          playsInline
          preload="none"
          onPlaying={onRunning}
          aria-hidden="true"
        />
        {/* A gallery at rest costs one image per card and not a byte of
            video. */}
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className={`${MEDIA_LAYER} transition-opacity duration-quick ease-standard ${isRunning ? 'opacity-0' : 'opacity-100'}`}
          style={{ objectPosition }}
        />
      </button>

      {isNew && <TemplateNewBadge />}

      {isSelected && (
        <span className={ACTIVE_BADGE}>
          <Check size={10} strokeWidth={3} />
        </span>
      )}

      <button
        type="button"
        onClick={() => onToggleFavorite(template.metadata.id)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className={
          isFavorite
            ? 'absolute top-1 right-1 p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-accent cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-1 focus-visible:outline-none focus-visible:bg-surface-1'
            : 'absolute top-1 right-1 p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-fg-faint cursor-pointer [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-[opacity,color,background-color] duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-1 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-1'
        }
      >
        <Star size={14} strokeWidth={2.25} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
});
