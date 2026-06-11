// banned-words-allow-file: close
import { createContext, useContext } from 'react';

export interface PopoverNav {
  navigate: (screen: string) => void;
  back: () => void;
  close: () => void;
  canGoBack: boolean;
}

export const PopoverNavContext = createContext<PopoverNav | null>(null);

/**
 * Read the navigator from the enclosing `<Popover>`. Screens use this to
 * push onto the screen stack (`navigate`), unwind history (`back`), or
 * dismiss the popover (`close`). Throws when used outside a Popover so
 * misuse fails loudly.
 */
export function usePopoverNav(): PopoverNav {
  const ctx = useContext(PopoverNavContext);
  if (!ctx) throw new Error('usePopoverNav must be used inside <Popover>');
  return ctx;
}
