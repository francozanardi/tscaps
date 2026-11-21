import type { InsetTransitionEdge } from '@core/elements/domain/fields/InsetTransitionField';

interface InsetTransitionIconProps {
  edge: InsetTransitionEdge;
  size: number;
}

/**
 * A picture-in-picture transition drawn in the motion cards' language: a
 * tall frame, outlined as the whole frame what floats starts or ends as,
 * the box filled where it rests, and an arrow from one to the other —
 * into the box coming in, out to the frame leaving.
 */
export function InsetTransitionIcon({ edge, size }: InsetTransitionIconProps) {
  const arrow = edge === 'entrance' ? 'M17 17l8 8m0-6v6h-6' : 'M25 25l-8-8m0 6v-6h6';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="13" y="7" width="22" height="34" rx="2.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
      <rect x="23" y="26" width="9" height="12" rx="1.5" fill="currentColor" />
      <path d={arrow} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
