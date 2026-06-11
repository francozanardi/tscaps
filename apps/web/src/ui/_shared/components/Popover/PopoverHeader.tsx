import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';

const HEADER_TITLE = 'font-mono text-2xs text-fg-faint uppercase tracking-[0.06em]';
const ICON_BTN =
  'flex items-center justify-center w-5 h-5 rounded-xs border-none bg-transparent text-fg-faint cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary';

interface PopoverHeaderProps {
  title: string;
  /** Optional element rendered to the right (e.g. a reset button). */
  action?: ReactNode | undefined;
}

/**
 * Header for a Popover screen with navigation. Auto-renders a back button
 * when there is screen history (i.e. a `navigate(...)` brought the user
 * here). The title sits next to it, and an optional `action` slot pins to
 * the right edge (used e.g. for "reset" on the word-style overrides screen).
 */
export function PopoverHeader({ title, action }: PopoverHeaderProps) {
  const { back, canGoBack } = usePopoverNav();
  return (
    <div className="flex items-center gap-1">
      {canGoBack && (
        <button
          type="button"
          className={ICON_BTN}
          title="Back"
          aria-label="Back"
          onClick={back}
        >
          <ChevronLeft size={13} />
        </button>
      )}
      <span className={HEADER_TITLE}>{title}</span>
      <div className="flex-1" />
      {action}
    </div>
  );
}
