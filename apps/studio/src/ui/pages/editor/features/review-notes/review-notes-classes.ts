/* Class strings shared by the review notes' components. */

const ICON_BUTTON_BASE =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs border border-transparent cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 '
  + 'disabled:opacity-40 disabled:cursor-not-allowed';

export const REVIEW_ICON_BUTTON =
  `${ICON_BUTTON_BASE} bg-transparent text-fg-muted enabled:hover:text-fg-primary enabled:hover:bg-surface-3`;

/** A tool that is picked: filled in the accent, so it reads as on at a glance. */
export const REVIEW_ICON_BUTTON_ACTIVE =
  `${ICON_BUTTON_BASE} bg-accent text-fg-on-accent enabled:hover:bg-accent-hover`;

/** The floating panels over the frame: the tool strip and the bubbles. */
export const REVIEW_FLOATING =
  'bg-surface-2 border border-edge-medium rounded-sm shadow-md text-fg-primary';

/** Widens what a finger can press around a small, absolutely placed control, without drawing it any larger. */
export const REVIEW_TOUCH_TARGET =
  "before:absolute before:inset-0 before:content-[''] [@media(pointer:coarse)]:before:-inset-3";

/** A note's numbered pin on the frame, hung above and to the right of its point so it never covers what it points at. */
export const REVIEW_PIN =
  'absolute translate-x-1 -translate-y-[calc(100%+0.25rem)] inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full '
  + 'bg-accent text-fg-on-accent text-2xs font-semibold tabular-nums leading-none border-2 border-white/80 shadow-md '
  + 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 '
  + REVIEW_TOUCH_TARGET;

/** The exact point a comment was dropped on: a ring, so what is under it still shows. */
export const REVIEW_POINT_RING =
  'absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-accent shadow-[0_0_0_1px_rgb(0_0_0/0.5)] pointer-events-none';
