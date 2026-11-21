import * as Tabs from '@radix-ui/react-tabs';

export interface TabStripItem {
  value: string;
  label: string;
}

interface TabStripProps {
  items: readonly TabStripItem[];
  /** Names what the strip is picking between, for assistive tech. */
  label: string;
  /** Appended to the strip's own classes — the baseline border, spacing. */
  className?: string;
}

const STRIP_CLASS = 'flex gap-4';

// No focus ring. Radix moves focus onto the trigger it activates, so a
// plain click leaves one behind — and the tab a ring would point at is
// the one the accent underline already marks, since selection follows
// focus here.
const STRIP_TAB_CLASS =
  'relative pb-2 bg-transparent border-none cursor-pointer text-xs '
  + 'transition-colors duration-quick ease-standard outline-none '
  + 'text-fg-muted hover:text-fg-secondary '
  + 'data-[state=active]:text-accent '
  + 'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent '
  + 'data-[state=active]:after:bg-accent';

/**
 * Underlined strip of text tabs, for picking which of a few peer
 * answers a panel is showing. Renders inside a `Tabs.Root`, which owns
 * the selection.
 *
 * Lighter than the icon rail: the rail is navigation across a panel's
 * sections, this is one panel's body switching what it reads.
 */
export function TabStrip({ items, label, className }: TabStripProps) {
  return (
    <Tabs.List className={className ? `${STRIP_CLASS} ${className}` : STRIP_CLASS} aria-label={label}>
      {items.map((item) => (
        <Tabs.Trigger key={item.value} value={item.value} className={STRIP_TAB_CLASS}>
          {item.label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}
