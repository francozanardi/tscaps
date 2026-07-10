import type { MouseEventHandler } from 'react';

interface WordmarkProps {
  /** When set, the wordmark renders as a link. Use `/` to point home. */
  readonly href?: string;
  /** Bypasses the link nav (e.g., to use react-router-dom programmatically). */
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
  /** `sm` for compact bars, `md` (default) for shells, `lg` for splash / hero. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Drives the dot blink — the app's "I'm working" signature. */
  readonly working?: boolean;
  readonly className?: string;
}

const SIZE_CLASS: Record<NonNullable<WordmarkProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
};

const BASE =
  'inline-flex items-baseline font-sans font-semibold tracking-[-0.04em] select-none';

/**
 * The single brand mark for the app. Reads as two words and a dot:
 * `ts` in the default foreground (the quiet prefix), `caps` in the
 * accent (the noun the product is named after), and the accent dot —
 * the "punto final" of a caption. Render as a link by passing `href`;
 * pass `working` to make the dot blink as the universal "the app is
 * doing something" indicator.
 *
 * At `size="lg"` (splash) the accent paints across `caps` once on
 * mount — a one-shot karaoke flourish. Chrome-sized marks (`sm`,
 * `md`) render statically.
 *
 * Never used decoratively or inline — see DESIGN_IDENTITY.md §Wordmark.
 */
export function Wordmark({ href, onClick, size = 'md', working = false, className = '' }: WordmarkProps) {
  const sizeClass = SIZE_CLASS[size];
  const isLink = href !== undefined;
  const isStage = size === 'lg';

  const hoverShift = isLink
    ? ' group-hover:text-accent-hover group-focus-visible:text-accent-hover'
    : '';

  const capsClass = `${isStage ? 'animate-caption-paint' : 'text-accent'} transition-colors duration-quick ease-standard${hoverShift}`;
  const dotClass = `text-accent ml-px transition-colors duration-quick ease-standard${hoverShift}${working ? ' animate-dot-blink' : ''}`;

  const content = (
    <>
      <span className="text-fg-primary">ts</span>
      <span className={capsClass}>caps</span>
      <span className={dotClass} aria-hidden="true">.</span>
    </>
  );

  if (isLink) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={`${BASE} group ${sizeClass} focus-visible:outline-none ${className}`}
        aria-label="tscaps — home"
      >
        {content}
      </a>
    );
  }

  return (
    <span className={`${BASE} ${sizeClass} ${className}`} aria-label="tscaps">
      {content}
    </span>
  );
}
