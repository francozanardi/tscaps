import { memo } from 'react';

const TEXT_CLASS = 'fill-current text-fg-faint';

/**
 * Hiding behind the person, drawn as a word with a figure standing in
 * front of half of it. The figure takes the card's tone, so it lights
 * up with the effect.
 */
export const BehindActorEffectPicture = memo(function BehindActorEffectPicture() {
  return (
    <svg viewBox="0 0 56 40" className="w-full h-full">
      <text x="9" y="26" fontSize="16" fontWeight="600" className={TEXT_CLASS}>Aa</text>
      <circle cx="33" cy="14" r="6" fill="currentColor" />
      <path d="M21 40 C21 28 26 23 33 23 C40 23 45 28 45 40 Z" fill="currentColor" />
    </svg>
  );
});
