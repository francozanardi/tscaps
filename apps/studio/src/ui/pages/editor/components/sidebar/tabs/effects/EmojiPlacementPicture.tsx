import { memo } from 'react';
import type { EmojiPlacement } from '@core/effect/domain/EffectConfig';

interface EmojiPlacementPictureProps {
  placement: EmojiPlacement;
}

const CAPTION_CLASS = 'fill-current text-fg-faint';

/**
 * Where an emoji goes, drawn as a caption (a bar) and its emoji (a dot
 * in the card's tone) in that arrangement.
 */
export const EmojiPlacementPicture = memo(function EmojiPlacementPicture({ placement }: EmojiPlacementPictureProps) {
  return (
    <svg viewBox="0 0 56 40" width="56" height="40">
      {placement === 'segment-below' && (
        <>
          <rect x="12" y="11" width="32" height="5" rx="2" className={CAPTION_CLASS} />
          <circle cx="28" cy="27" r="5" fill="currentColor" />
        </>
      )}
      {placement === 'segment-above' && (
        <>
          <circle cx="28" cy="13" r="5" fill="currentColor" />
          <rect x="12" y="24" width="32" height="5" rx="2" className={CAPTION_CLASS} />
        </>
      )}
      {placement === 'word' && (
        <>
          <rect x="6" y="17.5" width="16" height="5" rx="2" className={CAPTION_CLASS} />
          <circle cx="28" cy="20" r="5" fill="currentColor" />
          <rect x="34" y="17.5" width="16" height="5" rx="2" className={CAPTION_CLASS} />
        </>
      )}
    </svg>
  );
});
