import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Template } from '@core/templates/domain/Template';
import type { WordSplitter } from '@tscaps/engine';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useTemplatePreviewArtifactsBuilder } from '@ui/_shared/contexts/TemplatePreviewArtifactsContext';
import { TemplatePreviewStatic } from '@ui/_shared/components/TemplatePreview/TemplatePreviewStatic';
import { TemplatePreviewAnimated } from '@ui/_shared/components/TemplatePreview/TemplatePreviewAnimated';

interface TemplatePreviewFrameProps {
  readonly template: Template;
  /** Drives the resting frame against the animated one. */
  readonly isHovered: boolean;
  /**
   * Element the animation checks the pointer against each frame, so it
   * can stop itself when a `mouseleave` never arrived.
   */
  readonly hostRef: RefObject<HTMLElement>;
  readonly onHoverLost: () => void;
  /** Aspect of the frame the template is drawn into. */
  readonly aspectClass: string;
}

// Every preview gets a unique class (`${PREVIEW_SCOPE_PREFIX}-${templateId}`)
// and the template's CSS is rewritten to sit under it, so two templates on
// one page cannot style each other.
const PREVIEW_SCOPE_PREFIX = 'tscaps-preview';

// The frame the template believes it is drawing into. Its own sizes are
// in `cqh`, so the container query size is what makes a preview look like
// the export rather than like whatever box it landed in.
const VIRTUAL_VIDEO_W = 720;
const VIRTUAL_VIDEO_H = 1280;

const FIT_PADDING_PX = 8;

// A template can be transparent, so the preview needs a ground that says
// so. Light squares on dark, a dark tint over the cream surface. Same
// recipe, theme-correct in both.
const CHECKERED_SQUARE = 'rgb(var(--color-fg-primary) / 0.07)';
const CHECKERED_BG: React.CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface-2))',
  backgroundImage: [
    `linear-gradient(45deg, ${CHECKERED_SQUARE} 25%, transparent 25%)`,
    `linear-gradient(-45deg, ${CHECKERED_SQUARE} 25%, transparent 25%)`,
    `linear-gradient(45deg, transparent 75%, ${CHECKERED_SQUARE} 75%)`,
    `linear-gradient(-45deg, transparent 75%, ${CHECKERED_SQUARE} 75%)`,
  ].join(', '),
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0px',
};

/**
 * What one template looks like, drawn from the template itself rather
 * than from a picture of it.
 *
 * Three things have to be in place for the markup to render as the
 * export would: the template's stylesheet rewritten under this
 * preview's own scope class, the SVG filters it references
 * materialised, and a container-query box at the frame size its `cqh`
 * lengths are written against. All three come from the artifacts
 * builder, which is why this needs its provider rather than only a
 * `Template`.
 *
 * It scales itself down to whatever box it is given, so the same
 * component serves a gallery card and a carousel tile without either
 * naming a font size.
 */
export function TemplatePreviewFrame({
  template,
  isHovered,
  hostRef,
  onHoverLost,
  aspectClass,
}: TemplatePreviewFrameProps) {
  const { wordSplitter } = useEngine();
  const artifacts = useTemplatePreviewArtifactsBuilder();
  const [fitScale, setFitScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const scopeClass = `${PREVIEW_SCOPE_PREFIX}-${template.metadata.id}`;

  const templateVars = useMemo(() => artifacts.buildWrapperVars(template), [template, artifacts]);
  const scopedCss = useMemo(
    () => artifacts.buildScopedCss(template, scopeClass),
    [template, scopeClass, artifacts],
  );
  const { filterDefsHtml, filterUrlVars } = useMemo(
    () => artifacts.buildFilterArtifacts(template, scopeClass, VIRTUAL_VIDEO_H),
    [template, scopeClass, artifacts],
  );

  const letterSplitter: WordSplitter | null = template.rendering.splitWordsIntoLetters
    ? wordSplitter
    : null;

  // Auto-fit: measure intrinsic content size against the box and scale
  // down, so the template's own font sizes cannot overflow it.
  // `width: max-content` on the wrapper keeps the measurement equal to
  // the natural rendered size.
  useLayoutEffect(() => {
    const preview = previewRef.current;
    const content = contentRef.current;
    if (!preview || !content) return;
    const measure = () => {
      const boxWidth = preview.clientWidth - FIT_PADDING_PX * 2;
      const boxHeight = preview.clientHeight - FIT_PADDING_PX * 2;
      const width = content.offsetWidth;
      const height = content.offsetHeight;
      if (width === 0 || height === 0 || boxWidth <= 0 || boxHeight <= 0) return;
      setFitScale(Math.min(boxWidth / width, boxHeight / height, 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    observer.observe(content);
    return () => observer.disconnect();
  }, [template, isHovered]);

  return (
    /* `scopeClass` MUST be present — it is the anchor the CSS below is scoped to. */
    <div
      ref={previewRef}
      className={`w-full ${aspectClass} flex items-center justify-center overflow-hidden relative ${scopeClass}`}
      style={{ ...CHECKERED_BG, ...templateVars, ...filterUrlVars } as React.CSSProperties}
    >
      <style>{scopedCss}</style>

      {filterDefsHtml && (
        <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
          <defs dangerouslySetInnerHTML={{ __html: filterDefsHtml }} />
        </svg>
      )}

      <div
        style={{
          width: VIRTUAL_VIDEO_W,
          height: VIRTUAL_VIDEO_H,
          containerType: 'size',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${fitScale})`,
          transformOrigin: 'center',
        }}
      >
        <div ref={contentRef} style={{ width: 'max-content' }}>
          {isHovered ? (
            <TemplatePreviewAnimated
              letterSplitter={letterSplitter}
              hostRef={hostRef}
              onHoverLost={onHoverLost}
            />
          ) : (
            <TemplatePreviewStatic template={template} letterSplitter={letterSplitter} />
          )}
        </div>
      </div>
    </div>
  );
}
