import { memo, useMemo, type CSSProperties } from 'react';
import type { Word, WordSplitter } from '@tscaps/engine';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';
import { cssKeysToReact } from '@ui/pages/editor/features/overlay/cssKeysToReact';
import { useBoundWord } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useDraggableWord } from '@ui/pages/editor/features/overlay/hooks/useDraggableWord';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();

interface WordViewProps {
  word: Word;
  segmentId: string;
  letterSplitter: WordSplitter | null;
  inlineStyle: Readonly<Record<string, string>>;
  /** Per-decoration inline styles, used when the host word carries a decoration. Ignored if the word has none. */
  decorationInlineStyle: Readonly<Record<string, string>>;
  /** When true, the inline decoration span is omitted because the glyph paints at its own anchor as a sibling. */
  suppressInlineDecoration: boolean;
}

const BASE_PAUSED_ANIMATION_STYLE = { animationPlayState: 'paused', animationFillMode: 'both' } as const;

export const WordView = memo(function WordView({
  word,
  segmentId,
  letterSplitter,
  inlineStyle,
  decorationInlineStyle,
  suppressInlineDecoration,
}: WordViewProps) {
  const ref = useBoundWord(word);
  useDraggableWord(word, segmentId, ref);
  const overrideStyle = useMemo(() => cssKeysToReact(inlineStyle) as CSSProperties, [inlineStyle]);

  const inlineDecoration = !suppressInlineDecoration && word.decoration
    ? (
      <WordDecorationSpan
        decoration={word.decoration}
        segmentId={segmentId}
        inlineStyle={decorationInlineStyle}
      />
    )
    : null;
  const trail = word.decoration?.trail ?? '';

  if (letterSplitter) {
    const letters = letterSplitter.split(word.displayText);
    const wordStyle: CSSProperties = {
      ...BASE_PAUSED_ANIMATION_STYLE,
      ...letterAnimationStyleBuilder.buildWordContainerVars(letters.length),
      ...overrideStyle,
    };
    return (
      <span ref={ref} style={wordStyle} data-tscaps-word-id={word.id}>
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
        {inlineDecoration}
        {trail}
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
      {inlineDecoration}
      {trail}
    </span>
  );
});
