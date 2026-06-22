import { memo, useLayoutEffect, useMemo, type CSSProperties } from 'react';
import type { Decoration, Segment, Word } from '@tscaps/engine';
import { cssKeysToReact } from '@ui/pages/editor/features/overlay/cssKeysToReact';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useBoundDecoration } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';

const WORD_DECORATION_CSS_CLASS = 'word-decoration';

const BASE_PAUSED_ANIMATION_STYLE = { animationPlayState: 'paused', animationFillMode: 'both' } as const;

interface WordDecorationSpanProps {
  decoration: Decoration;
  /** Home segment of the host word — supplies both the drop-back-to-flow target id and the ancestor time window for the engine bindings. */
  segment: Segment;
  /** Host word, supplies the fallback time window when the decoration has no `customTime`. */
  word: Word;
  inlineStyle: Readonly<Record<string, string>>;
}

export const WordDecorationSpan = memo(function WordDecorationSpan({
  decoration,
  segment,
  word,
  inlineStyle,
}: WordDecorationSpanProps) {
  const manipulation = useOverlayManipulationController();
  const ref = useBoundDecoration(decoration, segment, word);

  useLayoutEffect(() => {
    const span = ref.current;
    if (!span) return;
    return manipulation.bindWord({ wordId: decoration.id, segmentId: segment.id, span });
  }, [manipulation, decoration.id, segment.id, ref]);

  const reactStyle = useMemo<CSSProperties>(
    () => ({ ...BASE_PAUSED_ANIMATION_STYLE, ...cssKeysToReact(inlineStyle) }) as CSSProperties,
    [inlineStyle],
  );

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
