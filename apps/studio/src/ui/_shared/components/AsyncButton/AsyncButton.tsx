import type { ButtonHTMLAttributes } from 'react';
import { useAsyncClickGuard } from '@ui/_shared/hooks/useAsyncClickGuard';

interface AsyncButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onClick: () => Promise<unknown> | void;
}

/**
 * A `<button>` whose click handler is guarded against re-entry while
 * its returned promise has not settled. The internal pending state is
 * OR'd with the caller's `disabled` prop, so both flags block clicks.
 * Sync handlers pass through without gating.
 */
export function AsyncButton({ onClick, disabled, type = 'button', ...rest }: AsyncButtonProps) {
  const { handler, pending } = useAsyncClickGuard(onClick);
  return <button {...rest} type={type} disabled={disabled || pending} onClick={handler} />;
}
