import { useEffect, useState, type RefObject } from 'react';
import type { WordSplitter } from '@tscaps/engine';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';
import { TemplatePreviewMock } from '@presentation/editor/services/TemplatePreviewMock';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();
const previewMock = new TemplatePreviewMock();

interface TemplatePreviewAnimatedProps {
  letterSplitter: WordSplitter | null;
  /** Element used to verify the pointer is still over the card each frame. */
  hostRef: RefObject<HTMLElement>;
  /** Called when the rAF detects the pointer left without a `mouseleave`. */
  onHoverLost: () => void;
}

/**
 * Live frame of the preview, mounted only while the card is hovered. Drives
 * `currentTime` with rAF so 3 mock words cycle through their narration
 * states.
 *
 * Each frame checks `hostRef.matches(':hover')` to self-heal if a
 * `mouseleave` event was missed (e.g. a modal opens over the card and the
 * pointer leaves before React notices) — without this, the rAF would tick
 * forever once the parent state desyncs from the actual hover state.
 */
export function TemplatePreviewAnimated({ letterSplitter, hostRef, onHoverLost }: TemplatePreviewAnimatedProps) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let rafId: number;
    const tick = (timestamp: number) => {
      if (hostRef.current && !hostRef.current.matches(':hover')) {
        onHoverLost();
        return;
      }
      if (!startTime) startTime = timestamp;
      setCurrentTime(((timestamp - startTime) / 1000) % previewMock.totalDuration);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hostRef, onHoverLost]);

  const segTime = previewMock.segment.time;
  const segVars = previewMock.segment.getCssVariables(currentTime, { indexInSection: 0 }) as React.CSSProperties;
  const lineVars = previewMock.line.getCssVariables(currentTime, { segTime }) as React.CSSProperties;
  const lineClass = previewMock.line.getCssClasses(currentTime).join(' ');

  return (
    <div
      className={previewMock.segment.getCssClasses(currentTime).join(' ')}
      style={{ animationPlayState: 'paused', animationFillMode: 'both', ...segVars } as React.CSSProperties}
    >
      <div
        className={lineClass}
        style={{ animationPlayState: 'paused', animationFillMode: 'both', ...lineVars } as React.CSSProperties}
      >
        {[...previewMock.line.words].map((word, indexInLine) => {
          const wordVars = word.getCssVariables(currentTime, { segTime, indexInLine }) as Record<string, string>;
          const wordClass = word.getCssClasses(currentTime).join(' ');
          if (letterSplitter) {
            const letters = letterSplitter.split(word.text);
            return (
              <span
                key={word.text}
                className={wordClass}
                style={{
                  animationPlayState: 'paused',
                  animationFillMode: 'both',
                  ...wordVars,
                  ...letterAnimationStyleBuilder.buildWordContainerVars(letters.length),
                }}
              >
                {letters.map((letter, i) => (
                  <span
                    key={i}
                    className="letter"
                    style={{
                      animationPlayState: 'paused',
                      animationFillMode: 'both',
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
              key={word.text}
              className={wordClass}
              style={{ animationPlayState: 'paused', animationFillMode: 'both', ...wordVars } as React.CSSProperties}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
