import { memo, useLayoutEffect, useMemo, type CSSProperties } from 'react';
import type { Decoration } from '@tscaps/engine';
import { cssKeysToReact } from '@ui/pages/editor/features/overlay/cssKeysToReact';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useBoundDecoration } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';

const WORD_DECORATION_CSS_CLASS = 'word-decoration';

interface WordDecorationSpanProps {
  decoration: Decoration;
  /** Home segment id of the host word — handed to the drag controller for the drop-back-to-flow gesture. */
  segmentId: string;
  inlineStyle: Readonly<Record<string, string>>;
}

export const WordDecorationSpan = memo(function WordDecorationSpan({
  decoration,
  segmentId,
  inlineStyle,
}: WordDecorationSpanProps) {
  const manipulation = useOverlayManipulationController();
  const ref = useBoundDecoration(decoration);

  useLayoutEffect(() => {
    const span = ref.current;
    if (!span) return;
    return manipulation.bindWord({ wordId: decoration.id, segmentId, span });
  }, [manipulation, decoration.id, segmentId, ref]);

  const reactStyle = useMemo<CSSProperties>(() => cssKeysToReact(inlineStyle) as CSSProperties, [inlineStyle]);

  return (
    <span
      ref={ref}
      className={WORD_DECORATION_CSS_CLASS}
      style={reactStyle}
      data-tscaps-word-id={decoration.id}
    >
      {decoration.glyph}
    </span>
  );
});
