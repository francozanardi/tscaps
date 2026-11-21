import type { ReactNode } from 'react';

interface InspectedElementThumbnailBoxProps {
  /** What fills the box: a picture covering it, or an icon or glyph centred in it. */
  children: ReactNode;
}

/**
 * The square every inspected element's picture sits in, the first thing
 * the inspector's header shows, so a shot, a b-roll and an emoji are
 * told apart at a glance before their names are read.
 *
 * A picture placed in it covers it (`absolute inset-0 object-cover`);
 * anything else is centred.
 */
export function InspectedElementThumbnailBox({ children }: InspectedElementThumbnailBoxProps) {
  return (
    <span
      className="shrink-0 relative flex items-center justify-center w-10 h-10 rounded-xs overflow-hidden bg-surface-3 border border-edge-subtle text-fg-faint"
      aria-hidden
    >
      {children}
    </span>
  );
}
