import { memo } from 'react';

const CAPTION_CLASS = 'fill-current text-fg-faint';

/**
 * Gap-free, drawn as two captions on a timeline: apart above, and below
 * with the first held until the second starts — the stretch it is held
 * for in the card's tone.
 */
export const GapFreePicture = memo(function GapFreePicture() {
  return (
    <svg viewBox="0 0 56 40" className="w-full h-full">
      <rect x="6" y="11" width="18" height="5" rx="2" className={CAPTION_CLASS} />
      <rect x="32" y="11" width="18" height="5" rx="2" className={CAPTION_CLASS} />
      <rect x="6" y="24" width="18" height="5" rx="2" className={CAPTION_CLASS} />
      <rect x="22" y="24" width="10" height="5" fill="currentColor" />
      <rect x="32" y="24" width="18" height="5" rx="2" className={CAPTION_CLASS} />
    </svg>
  );
});
