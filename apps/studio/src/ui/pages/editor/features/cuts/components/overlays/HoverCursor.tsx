const HOVER_CURSOR_CLASS = 'bg-accent/80';

interface HoverCursorProps {
  fraction: number;
}

/**
 * Thin vertical line under the pointer while it hovers a segment's
 * timeline. `fraction` is the pointer position as 0..1 of the row width.
 */
export function HoverCursor({ fraction }: HoverCursorProps) {
  return (
    <div
      className={HOVER_CURSOR_CLASS}
      style={{
        position: 'absolute',
        left: `${fraction * 100}%`,
        top: 0,
        bottom: 0,
        width: 1,
      }}
    />
  );
}
