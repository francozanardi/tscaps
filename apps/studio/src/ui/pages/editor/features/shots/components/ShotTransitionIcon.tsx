import type { ShotTransitionKind } from '@core/shots/domain/ShotTransition';

interface ShotTransitionIconProps {
  kind: ShotTransitionKind;
  size: number;
}

const STROKE = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/**
 * A transition between shots drawn in the motion cards' language: the
 * shot before on the left, the next on the right, and between them what
 * happens on the cut.
 */
export function ShotTransitionIcon({ kind, size }: ShotTransitionIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="15" width="11" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="34" y="15" width="11" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <ShotTransitionGlyph kind={kind} />
    </svg>
  );
}

/** What happens on the cut, between the two shots. */
function ShotTransitionGlyph({ kind }: { kind: ShotTransitionKind }) {
  switch (kind) {
    case 'flash':
      return <path d="M24 13.5c.8 5.6 3.9 8.7 9.5 10.5-5.6 1.8-8.7 4.9-9.5 10.5-.8-5.6-3.9-8.7-9.5-10.5 5.6-1.8 8.7-4.9 9.5-10.5z" fill="currentColor" />;
    case 'fade-white':
      return <rect x="18.5" y="15" width="11" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />;
    case 'fade-black':
      return <rect x="18.5" y="15" width="11" height="18" rx="2" fill="currentColor" />;
    case 'blur':
      return (
        <>
          <circle cx="24" cy="24" r="8.5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.5" />
          <circle cx="24" cy="24" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.75" />
          <circle cx="24" cy="24" r="2.5" fill="currentColor" />
        </>
      );
    case 'whip':
      return <path d="M17 19h12m-9 5h13m-10 5h9m-3-14 5 5-5 5" {...STROKE} />;
    case 'whip-up':
      return <path d="M19 31V19m5 14V18m5 13V21m-14-1 5-5 5 5" {...STROKE} />;
    case 'spin':
      return <path d="M30 20.5a7 7 0 1 0 1 6.5m-1-6.5v-4m0 4h-4" {...STROKE} />;
    case 'shake':
      return <path d="M17 24h3l2-6 4 12 2-6h3" {...STROKE} />;
    case 'glitch':
      return (
        <>
          <rect x="17" y="16" width="9" height="4" rx="1" fill="currentColor" />
          <rect x="21" y="22" width="10" height="4" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="18" y="28" width="8" height="4" rx="1" fill="currentColor" />
        </>
      );
    case 'wipe':
      return (
        <>
          <rect x="18.5" y="15" width="11" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <path d="M18.5 17a2 2 0 0 1 2-2H24v18h-3.5a2 2 0 0 1-2-2z" fill="currentColor" />
        </>
      );
    case 'iris':
      return <path d="M20.5 15h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V17a2 2 0 0 1 2-2zM24 20.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z" fill="currentColor" fillRule="evenodd" />;
  }
}
