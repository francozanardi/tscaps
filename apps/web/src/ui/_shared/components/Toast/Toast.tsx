import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'error';
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface ToastProps {
  readonly open: boolean;
  readonly icon?: ReactNode;
  readonly tone?: ToastTone;
  readonly title: string;
  readonly description?: string;
  readonly position?: ToastPosition;
  /** Auto-dismiss delay in milliseconds. Omit for a persistent toast. */
  readonly duration?: number;
  readonly onDismiss: () => void;
}

const TONE_ICON: Record<ToastTone, string> = {
  info: 'text-fg-secondary',
  success: 'text-accent',
  error: 'text-danger',
};

// The outer wrapper owns positioning (including the horizontal translate
// used to center the *-center variants). The inner wrapper owns the
// slide-in animation, which also uses `transform`. Splitting them keeps
// the two transforms from clobbering each other.
const POSITION_OUTER: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
};

const POSITION_ANIM: Record<ToastPosition, string> = {
  'top-left': 'animate-toast-in-from-top',
  'top-center': 'animate-toast-in-from-top',
  'top-right': 'animate-toast-in-from-top',
  'bottom-left': 'animate-toast-in-from-bottom',
  'bottom-center': 'animate-toast-in-from-bottom',
  'bottom-right': 'animate-toast-in-from-bottom',
};

/**
 * Persistent corner notice. Stays until the user dismisses it — for
 * events the user may miss if they walked away from the tab.
 */
export function Toast({ open, icon, tone = 'info', title, description, position = 'bottom-right', duration, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!open || !duration) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onDismiss]);

  if (!open) return null;
  return (
    <div className={`fixed z-[900] max-w-sm ${POSITION_OUTER[position]}`}>
      <div
        role="status"
        aria-live="polite"
        className={`bg-surface-2 border border-edge-subtle rounded-md shadow-sm px-4 py-3 flex items-start gap-3 ${POSITION_ANIM[position]}`}
      >
        {icon && <span className={`shrink-0 mt-px ${TONE_ICON[tone]}`}>{icon}</span>}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm text-fg-primary leading-snug">{title}</span>
          {description && (
            <span className="text-xs text-fg-muted leading-snug">{description}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 p-1 rounded-xs text-fg-faint cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:border focus-visible:border-accent"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
