import type { ShotLayerSplitTransitionKind } from '@core/shots/domain/ShotLayerSplitTransitions';

interface SplitTransitionIconProps {
  kind: Exclude<ShotLayerSplitTransitionKind, 'cut'>;
  /** Which end the transition plays at: the line moves down as the layer comes in, and back up as it leaves. */
  edge: 'entrance' | 'exit';
  size: number;
}

/**
 * A split transition drawn in the motion cards' language: a tall frame
 * whose top part is the layer, the video below it, the line between
 * them moving down as the layer comes in and back up as it leaves.
 * *Slide* moves the layer's picture in from above the frame (and back
 * out), the line riding its edge; *Reveal* keeps the picture where it
 * rests, outlined, and fills only what the line has uncovered so far.
 */
export function SplitTransitionIcon({ kind, edge, size }: SplitTransitionIconProps) {
  const arrowTop = kind === 'slide' ? 17 : 13;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="13" y="11" width="18" height="33" rx="2.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {kind === 'slide' ? (
        <>
          <rect x="13" y="3" width="18" height="7" rx="1.5" fill="currentColor" opacity="0.2" />
          <path d="M13 13.5a2.5 2.5 0 0 1 2.5-2.5h13a2.5 2.5 0 0 1 2.5 2.5V24H13z" fill="currentColor" />
        </>
      ) : (
        <>
          <path d="M13 13.5a2.5 2.5 0 0 1 2.5-2.5h13a2.5 2.5 0 0 1 2.5 2.5V27.5H13z" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6" />
          <path d="M13 13.5a2.5 2.5 0 0 1 2.5-2.5h13a2.5 2.5 0 0 1 2.5 2.5V20H13z" fill="currentColor" />
        </>
      )}
      <path d={kind === 'slide' ? 'M11 24h22' : 'M11 20h22'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d={edge === 'entrance'
          ? `M38 ${arrowTop}v10m-3-3 3 3 3-3`
          : `M38 ${arrowTop + 10}v-10m-3 3 3-3 3 3`}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
