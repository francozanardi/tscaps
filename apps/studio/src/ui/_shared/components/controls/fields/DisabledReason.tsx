import type { ReactNode } from 'react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface DisabledReasonProps {
  /** Why the field inside cannot be changed, or null while it can. */
  reason: string | null;
  children: ReactNode;
}

// A disabled control swallows the pointer in some browsers, so its parts
// let it through to the row, which is what hovering or tapping reaches.
const LOCKED_ROW_CLASS = 'block w-full cursor-not-allowed [&_*]:pointer-events-none';

/**
 * Says why a field is disabled where the user reaches for it: hovering
 * the field, focusing it, or tapping it on a touch screen opens a
 * tooltip with the reason, rather than a line of text under it that
 * reads as a description. With no reason the field is drawn as it is.
 */
export function DisabledReason({ reason, children }: DisabledReasonProps) {
  if (reason === null) return <>{children}</>;
  return (
    <Tooltip text={reason} tapToOpen fullWidth>
      <span className={LOCKED_ROW_CLASS} tabIndex={0}>
        {children}
      </span>
    </Tooltip>
  );
}
