import type { ReactNode } from 'react';

export type StatusPillTone = 'subtle' | 'info' | 'success' | 'warning' | 'danger';

interface StatusPillProps {
  readonly label: string;
  /** Drives the leading dot color. Defaults to `subtle`. */
  readonly tone?: StatusPillTone;
  /** Optional trailing percentage. Rendered with tabular numerics. */
  readonly progress?: number;
  /** Pulses the leading dot for "in-progress" states (saving, transcribing, exporting). */
  readonly active?: boolean;
  /** Optional leading icon, sized to ~12px. Overrides the dot. */
  readonly icon?: ReactNode;
  readonly className?: string;
}

const PILL =
  'inline-flex items-center gap-1.5 ' +
  'bg-surface-2 border border-edge-subtle rounded-pill ' +
  'px-2 py-0.5 ' +
  'font-mono text-3xs uppercase tracking-[0.06em] text-fg-secondary ' +
  'whitespace-nowrap select-none';

const DOT_BASE = 'inline-block w-[5px] h-[5px] rounded-full shrink-0';

const TONE_DOT: Record<StatusPillTone, string> = {
  subtle: 'bg-fg-faint',
  info: 'bg-accent',
  success: 'bg-info', // semantic green sits in `info` family for now; revisit if a dedicated --color-success lands
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Mono uppercase pill for state ("SAVED", "TRANSCRIBING", "EXPORTING 47%").
 * The signature of "this is state, not content". A small leading dot
 * carries the tone; the rest of the pill is chromatically neutral so
 * a row of pills reads cleanly.
 *
 * Design spec: see DESIGN_IDENTITY.md §Status pills.
 */
export function StatusPill({
  label,
  tone = 'subtle',
  progress,
  active = false,
  icon,
  className = '',
}: StatusPillProps) {
  const dot = icon ?? (
    <span
      className={`${DOT_BASE} ${TONE_DOT[tone]}${active ? ' animate-dot-blink' : ''}`}
      aria-hidden="true"
    />
  );

  return (
    <span className={`${PILL} ${className}`} role="status" aria-live="polite">
      {dot}
      <span>{label}</span>
      {progress !== undefined && (
        <span className="tabular-nums">{Math.round(progress)}%</span>
      )}
    </span>
  );
}
