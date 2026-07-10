import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';

interface LoadingSplashProps {
  /** Optional context-specific label below the brand mark. */
  readonly label?: string;
  /** `fullscreen` covers the viewport; `inline` fits inside a parent. */
  readonly variant?: 'fullscreen' | 'inline';
}

const FULLSCREEN =
  'fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 ' +
  'bg-surface-0 text-fg-primary';

const INLINE =
  'flex flex-col items-center justify-center gap-4 py-12 text-fg-primary';

const LABEL = 'text-sm text-fg-muted';

/**
 * Unified loading affordance for the app. Centers the brand mark with
 * its dot blinking ("the app is doing something") and an optional
 * label. Use `fullscreen` for app-level bootstraps (landing chunks,
 * editor chunks, page handoffs) and `inline` for sub-sections that
 * need the same identity at smaller scale.
 *
 * The matching pre-React variant lives inline in `index.html` so the
 * splash is visible from the very first frame — this component takes
 * over once the bundle mounts.
 */
export function LoadingSplash({ label, variant = 'fullscreen' }: LoadingSplashProps) {
  return (
    <div
      className={variant === 'fullscreen' ? FULLSCREEN : INLINE}
      role="status"
      aria-live="polite"
    >
      <Wordmark size="lg" working />
      {label
        ? <span className={LABEL}>{label}</span>
        : <span className="sr-only">Loading</span>}
    </div>
  );
}
