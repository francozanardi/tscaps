import { memo } from 'react';

const FRAME_CLASS = 'relative isolate flex w-full h-full';
// One half is light and the other dark in either theme, which is all
// the inversion needs; which side is which does not matter.
const INK_HALF_CLASS = 'flex-1 bg-fg-primary';
const PAPER_HALF_CLASS = 'flex-1 bg-surface-0';
const TEXT_CLASS =
  'absolute inset-0 flex items-center justify-center text-sm font-semibold text-white mix-blend-difference';

/**
 * Blending with the video, drawn by doing it: one word across a light
 * and a dark half, inverted by the same `difference` the element gets.
 */
export const BlendEffectPicture = memo(function BlendEffectPicture() {
  return (
    <span className={FRAME_CLASS}>
      <span className={INK_HALF_CLASS} />
      <span className={PAPER_HALF_CLASS} />
      <span className={TEXT_CLASS}>Aa</span>
    </span>
  );
});
