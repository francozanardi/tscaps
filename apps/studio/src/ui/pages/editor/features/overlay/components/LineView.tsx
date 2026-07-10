import { memo, type CSSProperties } from 'react';
import type { Line, Segment, Word, WordSplitter } from '@tscaps/engine';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import { WordView } from '@ui/pages/editor/features/overlay/components/words/WordView';
import { useBoundLine } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useDraggedWordId } from '@ui/pages/editor/features/overlay/hooks/useDraggedWordId';

interface LineViewProps {
  line: Line;
  segment: Segment;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Decoration ids whose inline `<span>` should be omitted — the glyph either paints out of flow at its own anchor, or the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
}

interface VisibleWord {
  word: Word;
  indexInLine: number;
}

// React must not set `className` on the line element — the overlay
// controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };

export const LineView = memo(function LineView({ line, segment, letterSplitter, wordStyleOverrides, inlineSuppressedDecorationIds }: LineViewProps) {
  const draggedWordId = useDraggedWordId();
  const visibleWords: VisibleWord[] = [];
  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i]!;
    if (wordStyleOverrides.hasAlignmentOverride(word.id)) continue;
    if (word.id === draggedWordId) continue;
    visibleWords.push({ word, indexInLine: i });
  }
  const ref = useBoundLine(line, segment, visibleWords.length > 0);
  if (visibleWords.length === 0) return null;
  return (
    <div ref={ref} style={PAUSED_ANIMATION_STYLE}>
      {visibleWords.map(({ word, indexInLine }) => (
        <WordView
          key={word.id}
          word={word}
          segment={segment}
          indexInLine={indexInLine}
          letterSplitter={letterSplitter}
          inlineStyle={wordStyleOverrides.buildInlineStyles(word.id)}
          suppressInlineDecoration={shouldSuppressInlineDecoration(word, inlineSuppressedDecorationIds)}
          decorationInlineStyle={word.decoration ? wordStyleOverrides.buildInlineStyles(word.decoration.id) : EMPTY_STYLE}
        />
      ))}
    </div>
  );
});

function shouldSuppressInlineDecoration(word: Word, inlineSuppressedDecorationIds: ReadonlySet<string>): boolean {
  if (!word.decoration) return false;
  return inlineSuppressedDecorationIds.has(word.decoration.id);
}

const EMPTY_STYLE: Readonly<Record<string, string>> = {};
