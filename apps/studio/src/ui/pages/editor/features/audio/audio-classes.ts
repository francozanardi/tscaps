/** Shared class strings of the Audio tab and the sound picker. */

/** A square icon button in a row: play, nudge, remove, the row's menu. */
export const ROW_ICON_BUTTON_CLASS =
  'inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-primary hover:bg-surface-3 focus-visible:outline-none focus-visible:text-fg-primary focus-visible:bg-surface-3 '
  + 'aria-pressed:text-accent disabled:opacity-40 disabled:cursor-not-allowed';

/** A heading over a group of rows: a category of sounds. */
export const GROUP_HEADING_CLASS = 'm-0 px-3 pt-2 pb-1 font-mono text-3xs uppercase tracking-[0.06em] text-fg-faint';

/** One sentence where a list holds nothing. */
export const EMPTY_LINE_CLASS = 'm-0 text-2xs text-fg-muted leading-snug';

/** A length or a time beside a name. */
export const FIGURE_CLASS = 'font-mono text-3xs text-fg-faint tabular-nums shrink-0';
