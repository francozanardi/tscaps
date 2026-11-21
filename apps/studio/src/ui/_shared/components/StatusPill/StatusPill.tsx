import type { ReactNode } from 'react';

export type StatusPillTone = 'subtle' | 'info' | 'success' | 'warning' | 'danger';

interface StatusPillProps {
  readonly label: string;
  /** Drives the pill's tint and text colour. Defaults to `subtle`, which carries no hue. */
  readonly tone?: StatusPillTone;
  /** Optional trailing percentage. Rendered with tabular numerics. */
  readonly progress?: number;
  /** Adds a pulsing dot for "in-progress" states (saving, transcribing, exporting). */
  readonly active?: boolean;
  /** Optional leading icon, sized to ~12px. Takes the dot's place. */
  readonly icon?: ReactNode;
  readonly className?: string;
}

const PILL =
  'inline-flex items-center gap-1.5 rounded-xs px-2 py-1 ' +
  'text-3xs font-medium leading-none whitespace-nowrap select-none';

// The tone tints the pill and colours its text; neutral rests on the
// hairline tint, the same ground attachment pills sit on.
const TONE_PILL: Record<StatusPillTone, string> = {
  subtle: 'bg-edge-faint text-fg-secondary',
  info: 'bg-accent/15 text-accent',
  success: 'bg-info/15 text-info', // semantic green sits in `info` family for now; revisit if a dedicated --color-success lands
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

const ACTIVE_DOT = 'inline-block w-[5px] h-[5px] rounded-full shrink-0 bg-current animate-dot-blink';

/**
 * Soft-tinted pill for state ("Saved", "Transcribing", "Exporting 47%"):
 * sentence case, no border, the tone carried by a faint fill and the
 * text colour, so it reads as state without shouting. Only an
 * in-progress state adds a pulsing dot.
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
  const lead = icon ?? (active ? <span className={ACTIVE_DOT} aria-hidden="true" /> : null);

  return (
    <span className={`${PILL} ${TONE_PILL[tone]} ${className}`} role="status" aria-live="polite">
      {lead}
      <span>{label}</span>
      {progress !== undefined && (
        <span className="tabular-nums">{Math.round(progress)}%</span>
      )}
    </span>
  );
}
