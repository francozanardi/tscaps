import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { useAsyncClickGuard } from '@ui/_shared/hooks/useAsyncClickGuard';

interface AsyncButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => Promise<unknown> | void;
  /** Draws a spinner beside the label while the click is in flight. */
  showPending?: boolean | undefined;
}

/**
 * A `<button>` whose click handler is guarded against re-entry while
 * its returned promise has not settled. The internal pending state is
 * OR'd with the caller's `disabled` prop, so both flags block clicks.
 * Sync handlers pass through without gating.
 *
 * The spinner is opt-in because most guarded clicks settle before
 * anyone could see one, and a flash of spinner reads as a stutter.
 */
export function AsyncButton({
  onClick,
  disabled,
  showPending,
  children,
  type = 'button',
  ...rest
}: AsyncButtonProps) {
  const { handler, pending } = useAsyncClickGuard(onClick);
  return (
    <button {...rest} type={type} disabled={disabled || pending} onClick={handler}>
      {showPending && pending && <Loader2 size={12} className="animate-spin" />}
      {children}
    </button>
  );
}
