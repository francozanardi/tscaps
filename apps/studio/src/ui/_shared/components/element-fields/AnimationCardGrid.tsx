import { memo, type ReactNode } from 'react';

interface AnimationCardGridProps {
  /** Names what the cards answer, for assistive tech. */
  label: string;
  /** The cards, in the order they are offered. */
  children: ReactNode;
  /**
   * Three columns whatever the width, for a container of a fixed width
   * (a popover), where a scrollbar appearing would otherwise take a
   * column away mid-pick. Absent, columns follow the width.
   */
  fixedColumns?: boolean;
}

// Columns follow the width rather than being counted: this panel is a
// sidebar on one layout and most of the window on another, and three
// fixed columns make cards twice as wide as they are tall on the second.
const GRID_CLASS = 'grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2';
const FIXED_GRID_CLASS = 'grid grid-cols-3 gap-2';

/**
 * The grid every motion picker lays its cards in, so a caption's and a
 * shot layer's read as one control: one card per answer, as many
 * columns as the width holds.
 */
export const AnimationCardGrid = memo(function AnimationCardGrid({ label, children, fixedColumns }: AnimationCardGridProps) {
  return (
    <div className={fixedColumns ? FIXED_GRID_CLASS : GRID_CLASS} role="group" aria-label={label}>
      {children}
    </div>
  );
});
