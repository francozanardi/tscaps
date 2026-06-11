// banned-words-allow-file: close
import type { Template } from '@core/templates/domain/Template';
import type { WordSplitter } from '@tscaps/engine';
import { LetterAnimationStyleBuilder } from '@presentation/editor/services/LetterAnimationStyleBuilder';
import { TemplatePreviewMock } from '@presentation/editor/services/TemplatePreviewMock';

const letterAnimationStyleBuilder = new LetterAnimationStyleBuilder();
const previewMock = new TemplatePreviewMock();

interface TemplatePreviewStaticProps {
  template: Template;
  letterSplitter: WordSplitter | null;
}

/**
 * Resting frame of the preview, rendered while the card is not hovered.
 * Shows the template name as a single highlighted word.
 *
 * CSS vars must be passed at every level — templates often gate animations
 * on `--on-word-being-narrated-starts` and friends; without them the
 * `var()` call invalidates the whole `animation` shorthand and any
 * `opacity:0` base state stays hidden.
 */
export function TemplatePreviewStatic({ template, letterSplitter }: TemplatePreviewStaticProps) {
  // Letter-mode templates need t close to word.end so every letter's slot has
  // fired (all letters visible) but the last letter's cursor window is still
  // active. Non-letter-mode keeps t mid-word so any BEING_NARRATED highlight
  // is on at peak.
  const t = letterSplitter ? previewMock.wordDuration * 0.99 : previewMock.wordDuration / 2;
  const { segment, line, word } = previewMock.singleWordFrame;
  const segVars = segment.getCssVariables(t) as React.CSSProperties;
  const lineVars = line.getCssVariables(t) as React.CSSProperties;
  const wordVars = word.getCssVariables(t) as Record<string, string>;
  const wordClass = word.getCssClasses(t).join(' ');

  // Inline play-state pause overrides the template's `animation:` shorthand,
  // which CSS specs reset to `running`. Without this, templates with
  // `animation: ... infinite` (e.g. wave/bob, glow pulses) keep ticking on
  // every visible card, even though the preview is a single frozen frame.
  const segStyle = { animationPlayState: 'paused', animationFillMode: 'both', ...segVars } as React.CSSProperties;
  const lineStyle = { animationPlayState: 'paused', animationFillMode: 'both', ...lineVars } as React.CSSProperties;

  if (letterSplitter) {
    const letters = letterSplitter.split(template.metadata.name);
    return (
      <div className={segment.getCssClasses(t).join(' ')} style={segStyle}>
        <div className={line.getCssClasses(t).join(' ')} style={lineStyle}>
          <span
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
        </div>
      </div>
    );
  }

  return (
    <div className={previewMock.segment.getCssClasses(t).join(' ')} style={segStyle}>
      <div className={previewMock.line.getCssClasses(t).join(' ')} style={lineStyle}>
        <span
          className={wordClass}
          style={{
            animationPlayState: 'paused',
            animationFillMode: 'both',
            ...wordVars,
          } as React.CSSProperties}
        >
          {template.metadata.name}
        </span>
      </div>
    </div>
  );
}
