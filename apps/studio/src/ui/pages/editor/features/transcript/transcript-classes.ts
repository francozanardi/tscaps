/**
 * Shared Tailwind class strings for the transcript subtab. Lives in this file
 * because the same popover/menu shape appears in `LineSettingsPopover`,
 * `SegmentSettingsPopover`, and `WordPopover` (settings-style menu rows),
 * and the settings-btn pattern is shared between segment header and line
 * row contexts. Inlining would force three- or four-way duplication.
 *
 * Group names (`group/seg-header`, `group/line`) appear here as literal
 * strings so Tailwind's JIT scanner picks them up.
 */

// ── Generic menu screen shape ───────────────────────────────────────────
// Inner padding + vertical layout for menu-style popover screens (Line /
// Segment settings). The visual chrome (bg/border/shadow/animations) is
// provided by `<Popover>`; this class only describes the inner shape.
export const POPOVER_MENU_SHAPE =
  'p-1 flex flex-col gap-0.5 min-w-[185px]';

const POPOVER_ITEM_BASE =
  'flex items-center gap-2 text-left w-full text-2xs px-2 py-[5px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none';

export const POPOVER_ITEM = `${POPOVER_ITEM_BASE} text-fg-secondary hover:bg-surface-3 hover:text-fg-primary focus-visible:bg-surface-3 focus-visible:text-fg-primary`;
// Muted-by-default semantic items (move = info, danger = destructive). The /75
// opacity dims the token so the action reads as "available but not shouting";
// hover lifts to the full color. Theme-aware via the underlying tokens.
export const POPOVER_ITEM_MOVE = `${POPOVER_ITEM_BASE} text-info/75 hover:bg-info/10 hover:text-info focus-visible:bg-info/10 focus-visible:text-info`;
export const POPOVER_ITEM_DANGER = `${POPOVER_ITEM_BASE} text-danger/75 hover:bg-danger/10 hover:text-danger focus-visible:bg-danger/10 focus-visible:text-danger`;

// ── Settings button (three-dot, fades in on parent hover) ──────────────
const SETTINGS_BTN_BASE =
  'inline-flex items-center justify-center px-[5px] py-[3px] rounded-xs border bg-transparent cursor-pointer ' +
  'transition-[background-color,color,opacity] duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:opacity-100 focus-visible:pointer-events-auto';

const SETTINGS_BTN_ACTIVE = `${SETTINGS_BTN_BASE} border-accent bg-accent/15 text-info opacity-100 pointer-events-auto`;

const SETTINGS_BTN_IDLE_SEG_HEADER =
  `${SETTINGS_BTN_BASE} border-transparent text-fg-faint hover:bg-surface-3 hover:text-fg-secondary focus-visible:bg-surface-3 focus-visible:text-fg-secondary`;

const SETTINGS_BTN_IDLE_LINE =
  `${SETTINGS_BTN_BASE} border-edge-medium text-fg-faint hover:bg-surface-3 hover:text-fg-secondary focus-visible:bg-surface-3 focus-visible:text-fg-secondary opacity-0 pointer-events-none group-hover/line:opacity-100 group-hover/line:pointer-events-auto`;

/**
 * Class for the three-dot settings button. The button stays hidden until its
 * parent row (segment header or line row) is hovered; while a popover is
 * open the active variant pins it visible regardless of hover.
 */
export function settingsBtnClass(active: boolean, parentGroup: 'seg-header' | 'line'): string {
  if (active) return SETTINGS_BTN_ACTIVE;
  return parentGroup === 'seg-header' ? SETTINGS_BTN_IDLE_SEG_HEADER : SETTINGS_BTN_IDLE_LINE;
}
