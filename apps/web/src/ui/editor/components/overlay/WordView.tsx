import { memo, useMemo, type CSSProperties } from 'react';
import type { Word, WordSplitter } from '@tscaps/engine';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';
import { cssKeysToReact } from '@ui/editor/components/overlay/cssKeysToReact';
import { useBoundWord } from '@ui/editor/components/overlay/useOverlayBinding';
import { useDraggableWord } from '@ui/editor/components/overlay/useDraggableWord';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();

interface WordViewProps {
  word: Word;
  /** Id of the segment that owns the word per the document tree.
   *  Threaded into the drag binding so the manipulation controller can
   *  detect a drop back into the home segment. */
  segmentId: string;
  /** When non-null, the word's text is rendered as one `.letter` span per unit produced by the splitter. */
  letterSplitter: WordSplitter | null;
  /**
   * Per-word CSS property overrides precomputed by the parent (typically via
   * `WordStyleOverrideRegistry.buildInlineStyles`). Inlined onto the span so
   * they win over template rules by inline > class specificity. Empty object
   * is fine.
   */
  inlineStyle: Readonly<Record<string, string>>;
}

// React must not set `className` on the word element — the overlay
// controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const BASE_PAUSED_ANIMATION_STYLE = { animationPlayState: 'paused', animationFillMode: 'both' } as const;

export const WordView = memo(function WordView({ word, segmentId, letterSplitter, inlineStyle }: WordViewProps) {
  const ref = useBoundWord(word);
  useDraggableWord(word, segmentId, ref);
  const overrideStyle = useMemo(() => cssKeysToReact(inlineStyle) as CSSProperties, [inlineStyle]);

  if (letterSplitter) {
    const letters = letterSplitter.split(word.displayText);
    const wordStyle: CSSProperties = {
      ...BASE_PAUSED_ANIMATION_STYLE,
      ...letterAnimationStyleBuilder.buildWordContainerVars(letters.length),
      ...overrideStyle,
    };
    return (
      <span
        ref={ref}
        style={wordStyle}
        data-tscaps-word-id={word.id}
      >
        {letters.map((letter, i) => (
          <span
            key={i}
            className="letter"
            style={{
              ...BASE_PAUSED_ANIMATION_STYLE,
              ...letterAnimationStyleBuilder.buildLetterVars(i),
            }}
          >
            {letter}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      style={{ ...BASE_PAUSED_ANIMATION_STYLE, ...overrideStyle }}
      data-tscaps-word-id={word.id}
    >
      {word.displayText}
    </span>
  );
});
