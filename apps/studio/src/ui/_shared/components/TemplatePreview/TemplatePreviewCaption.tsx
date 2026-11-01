import type { CSSProperties } from 'react';
import type { DecorationPlacementSide, Segment, TimeFragment, Word, WordSplitter } from '@tscaps/engine';
import type { PreviewCaption } from '@presentation/editor/services/TemplatePreviewMock';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();

interface TemplatePreviewCaptionProps {
  readonly caption: PreviewCaption;
  /** Seconds into the caption the frame shows. */
  readonly time: number;
  /** Splits each word into letter spans, for a template animating letters; `null` keeps words whole. */
  readonly letterSplitter: WordSplitter | null;
  /** The side of the caption its emojis paint in a row on, or `null` to keep each inside its word. */
  readonly emojiSide: DecorationPlacementSide | null;
}

/**
 * One frame of a preview caption, in the markup the editor's overlay
 * gives a caption: segment, lines, words, and each word's emoji inside
 * it or in the caption's row above or below. Every node carries the
 * classes and time variables of `time`, so the template styles it as it
 * would that moment of a real caption.
 *
 * CSS vars must be passed at every level — templates often gate
 * animations on `--on-word-being-narrated-starts` and friends; without
 * them the `var()` call invalidates the whole `animation` shorthand and
 * any `opacity:0` base state stays hidden.
 */
export function TemplatePreviewCaption({ caption, time, letterSplitter, emojiSide }: TemplatePreviewCaptionProps) {
  const { segment } = caption;
  const segTime = segment.time;
  return (
    <div
      className={segment.getCssClasses(time).join(' ')}
      style={segment.getCssVariables(time, { segmentIndex: 0 }) as CSSProperties}
    >
      {emojiSide === 'above' && <EmojiRow segment={segment} time={time} side="above" />}
      {segment.lines.map((line) => (
        <div
          key={line.id}
          className={line.getCssClasses(time).join(' ')}
          style={line.getCssVariables(time, { segTime }) as CSSProperties}
        >
          {line.words.map((word, indexInLine) => (
            <PreviewWord
              key={word.id}
              word={word}
              time={time}
              segTime={segTime}
              indexInLine={indexInLine}
              letterSplitter={letterSplitter}
              emojiInside={emojiSide === null}
            />
          ))}
        </div>
      ))}
      {emojiSide === 'below' && <EmojiRow segment={segment} time={time} side="below" />}
    </div>
  );
}

interface PreviewWordProps {
  readonly word: Word;
  readonly time: number;
  readonly segTime: TimeFragment;
  readonly indexInLine: number;
  readonly letterSplitter: WordSplitter | null;
  readonly emojiInside: boolean;
}

function PreviewWord({ word, time, segTime, indexInLine, letterSplitter, emojiInside }: PreviewWordProps) {
  const wordVars = word.getCssVariables(time, { segTime, indexInLine }) as Record<string, string>;
  const emoji = emojiInside ? <PreviewEmoji word={word} time={time} segTime={segTime} /> : null;
  if (!letterSplitter) {
    return (
      <span className={word.getCssClasses(time).join(' ')} style={wordVars as CSSProperties}>
        {word.text}
        {emoji}
      </span>
    );
  }
  const letters = letterSplitter.split(word.text);
  return (
    <span
      className={word.getCssClasses(time).join(' ')}
      style={{ ...wordVars, ...letterAnimationStyleBuilder.buildWordContainerVars(letters.length) } as CSSProperties}
    >
      {letters.map((letter, index) => (
        <span key={index} className="letter" style={letterAnimationStyleBuilder.buildLetterVars(index) as CSSProperties}>
          {letter}
        </span>
      ))}
      {emoji}
    </span>
  );
}

interface EmojiRowProps {
  readonly segment: Segment;
  readonly time: number;
  readonly side: 'above' | 'below';
}

function EmojiRow({ segment, time, side }: EmojiRowProps) {
  const decorated = segment.getWords().filter((word) => word.decoration !== null);
  if (decorated.length === 0) return null;
  return (
    <div className={side === 'above' ? 'segment-decorations-above' : 'segment-decorations-below'}>
      {decorated.map((word) => <PreviewEmoji key={word.id} word={word} time={time} segTime={segment.time} />)}
    </div>
  );
}

interface PreviewEmojiProps {
  readonly word: Word;
  readonly time: number;
  readonly segTime: TimeFragment;
}

function PreviewEmoji({ word, time, segTime }: PreviewEmojiProps) {
  const decoration = word.decoration;
  if (!decoration) return null;
  return (
    <span
      className="word-decoration"
      style={decoration.getCssVariables(time, { segTime, wordTime: word.time }) as CSSProperties}
    >
      {decoration.glyph}
    </span>
  );
}
