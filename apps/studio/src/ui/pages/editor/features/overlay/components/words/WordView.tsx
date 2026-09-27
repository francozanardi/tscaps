import { memo, useMemo, type CSSProperties } from 'react';
import type { Segment, Word, WordFragment, WordSplitter } from '@tscaps/engine';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';
import { useBoundWord } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useMeasuredWidth } from '@ui/pages/editor/features/overlay/hooks/useMeasuredWidth';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useDraggableWord } from '@ui/pages/editor/features/overlay/hooks/useDraggableWord';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();

const NO_EXTRA_CLASSES: ReadonlyArray<string> = [];

interface WordViewProps {
  word: Word;
  /** The stretch of the word this element paints. A word split across bidi levels renders one element per fragment. */
  fragment: WordFragment;
  /** Whether the fragment painted right after this one reads continuously with it, so the gap between them must close. */
  closeGapAfter: boolean;
  segment: Segment;
  /** Zero-based position of `word` inside its line, published as `--word-index`. */
  indexInLine: number;
  letterSplitter: WordSplitter | null;
  /** Resolved `font-family` this word declares because its script differs from its surroundings, or `undefined` to inherit the cascade. */
  fontFamily: string | undefined;
  /** When true, the inline decoration span is omitted because the glyph paints at its own anchor as a sibling. */
  suppressInlineDecoration: boolean;
  /** Whether this fragment is the one that renders the word's trailing text. */
  carriesTrail: boolean;
}

export const WordView = memo(function WordView({
  word,
  fragment,
  closeGapAfter,
  segment,
  indexInLine,
  letterSplitter,
  fontFamily,
  suppressInlineDecoration,
  carriesTrail,
}: WordViewProps) {
  const { constants } = useEngine();
  const extraClasses = useMemo(
    () => fragment.carriesWordBody ? NO_EXTRA_CLASSES : [constants.DETACHED_WORD_FRAGMENT_CLASS],
    [fragment.carriesWordBody, constants.DETACHED_WORD_FRAGMENT_CLASS],
  );
  const ref = useBoundWord(word, segment, indexInLine, extraClasses);
  useMeasuredWidth(ref, constants.WORD_WIDTH_EM_VARIABLE);
  useDraggableWord(word, segment.id, ref);
  const overrideStyle = useMemo<CSSProperties>(
    () => fontFamily === undefined ? {} : { fontFamily },
    [fontFamily],
  );
  const fragmentStyle = useMemo(
    () => buildFragmentStyle(fragment, closeGapAfter),
    [fragment, closeGapAfter],
  );

  const inlineDecoration = !suppressInlineDecoration && word.decoration
    ? (
      <WordDecorationSpan
        decoration={word.decoration}
        segment={segment}
        word={word}
      />
    )
    : null;
  const trail = carriesTrail ? word.decoration?.trail ?? '' : '';

  // Letters of a joining script take their shape from their neighbours, so
  // painting them one box at a time would leave the word disconnected.
  if (letterSplitter && !fragment.charactersJoin) {
    const letters = letterSplitter.split(fragment.text);
    const wordStyle: CSSProperties = {
      ...letterAnimationStyleBuilder.buildWordContainerVars(letters.length),
      ...overrideStyle,
      ...fragmentStyle,
    };
    return (
      <span ref={ref} style={wordStyle} data-tscaps-word-id={word.id} {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: word.id }}>
        {letters.map((letter, i) => (
          <span
            key={i}
            className="letter"
            style={letterAnimationStyleBuilder.buildLetterVars(i)}
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
      style={{ ...overrideStyle, ...fragmentStyle }}
      data-tscaps-word-id={word.id}
      {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: word.id }}
    >
      {fragment.text}
      {inlineDecoration}
      {trail}
    </span>
  );
});

/**
 * Direction and gap corrections a fragment needs on top of the word styling.
 * Only a fragment reading against the line's left-to-right flow states its
 * direction; the rest inherit it.
 */
function buildFragmentStyle(fragment: WordFragment, closeGapAfter: boolean): CSSProperties {
  const style: CSSProperties = {};
  if (fragment.direction === 'rtl') style.direction = 'rtl';
  if (fragment.joinedToPrevious) style.marginLeft = 0;
  if (closeGapAfter) style.marginRight = 0;
  return style;
}
