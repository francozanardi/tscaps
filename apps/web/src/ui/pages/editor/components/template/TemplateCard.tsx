import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Star, Trash2, Pencil } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import type { WordSplitter } from '@tscaps/engine';
import { useTemplatePreviewArtifactsBuilder } from '@ui/pages/editor/contexts/TemplatePreviewArtifactsContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { TemplatePreviewStatic } from '@ui/pages/editor/components/template/TemplatePreviewStatic';
import { TemplatePreviewAnimated } from '@ui/pages/editor/components/template/TemplatePreviewAnimated';

interface TemplateCardProps {
  template: Template;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (template: Template) => void;
  onToggleFavorite: (templateId: string) => void;
  /**
   * Removes this template from the user library. Provide only for
   * user-saved templates surfaced in a management view; built-ins
   * leave it unset so no delete affordance appears.
   */
  onDelete?: (() => void) | undefined;
  /**
   * Opens a rename flow for this template. Surfaced with the same
   * gating as `onDelete` — user-saved entries only.
   */
  onRename?: (() => void) | undefined;
}

// Scope-class prefix for the per-template CSS injected via CssScoper. Each
// preview gets a unique class (`${PREVIEW_SCOPE_PREFIX}-${templateId}`) and
// the scoped CSS targets `.${scopeClass}` so previews don't bleed into
// each other.
const PREVIEW_SCOPE_PREFIX = 'tscaps-preview';

// Synthetic video container for the preview: `container-type: size` plus
// fixed reference dimensions (matching the authoring reference) give
// template `cqh` / `cqw` units a stable resolution independent of the
// browser viewport.
const VIRTUAL_VIDEO_W = 720;
const VIRTUAL_VIDEO_H = 1280;

// Checkered transparency pattern for the preview canvas — keeps transparent /
// dark subtitle styles visible. Inline because Tailwind arbitrary syntax for
// 4 layered linear-gradients with positions is hard to read.
//
// Square color is `fg-primary` at low alpha so it adapts per theme: in dark
// mode that's a faint light tint over a dark surface; in light mode a faint
// dark tint over the cream surface. Same recipe, theme-correct in both.
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

export const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onDelete,
  onRename,
}: TemplateCardProps) {
  const { wordSplitter } = useEngine();
  const templatePreviewArtifactsBuilder = useTemplatePreviewArtifactsBuilder();
  const [isHovered, setIsHovered] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  // Hover host on the wrapper (not the inner button) so the favorite overlay doesn't break hover.
  const hostRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const scopeClass = `${PREVIEW_SCOPE_PREFIX}-${template.metadata.id}`;

  const templateVars = useMemo(
    () => templatePreviewArtifactsBuilder.buildWrapperVars(template),
    [template, templatePreviewArtifactsBuilder],
  );
  const scopedCss = useMemo(
    () => templatePreviewArtifactsBuilder.buildScopedCss(template, scopeClass),
    [template, scopeClass, templatePreviewArtifactsBuilder],
  );
  const { filterDefsHtml, filterUrlVars } = useMemo(
    () => templatePreviewArtifactsBuilder.buildFilterArtifacts(template, scopeClass, VIRTUAL_VIDEO_H),
    [template, scopeClass, templatePreviewArtifactsBuilder],
  );

  const letterSplitter: WordSplitter | null = template.rendering.splitWordsIntoLetters
    ? wordSplitter
    : null;

  // Auto-fit: measure intrinsic content size vs. card and scale down so the
  // template's own font sizes don't overflow the card. `width: max-content`
  // on the wrapper keeps measurement equal to the natural rendered size.
  useLayoutEffect(() => {
    const preview = previewRef.current;
    const content = contentRef.current;
    if (!preview || !content) return;
    const padding = 8;
    const measure = () => {
      const cw = preview.clientWidth - padding * 2;
      const ch = preview.clientHeight - padding * 2;
      const w = content.offsetWidth;
      const h = content.offsetHeight;
      if (w === 0 || h === 0 || cw <= 0 || ch <= 0) return;
      setFitScale(Math.min(cw / w, ch / h, 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(preview);
    ro.observe(content);
    return () => ro.disconnect();
  }, [template, isHovered]);

  // Stable so the rAF effect inside TemplatePreviewAnimated doesn't reset
  // every render of the card.
  const onHoverLost = useCallback(() => setIsHovered(false), []);

  return (
    <div
      ref={hostRef}
      className="relative group/card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className={
          isSelected
            ? 'w-full bg-transparent border-[1.5px] rounded-md cursor-pointer flex flex-col overflow-hidden p-0 transition-colors duration-quick ease-standard border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'
            : 'w-full bg-transparent border-[1.5px] rounded-md cursor-pointer flex flex-col overflow-hidden p-0 transition-colors duration-quick ease-standard border-edge-subtle hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30'
        }
        onClick={() => onSelect(template)}
      >
        {/* `scopeClass` MUST be present — it's the scope anchor for the CSS injected below. */}
        <div
          ref={previewRef}
          className={`w-full aspect-[4/2] flex items-center justify-center overflow-hidden relative ${scopeClass}`}
          style={{ ...CHECKERED_BG, ...templateVars, ...filterUrlVars } as React.CSSProperties}
        >
          {/* Scoped CSS — isolates this template's styles from other previews */}
          <style>{scopedCss}</style>

          {/* Materialized SVG filter defs this template's CSS references. */}
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
                <TemplatePreviewStatic
                  template={template}
                  letterSplitter={letterSplitter}
                />
              )}
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(template.metadata.id)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className={
          isFavorite
            ? 'absolute top-1 right-1 p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-accent cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-1 focus-visible:outline-none focus-visible:bg-surface-1'
            : 'absolute top-1 right-1 p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-fg-faint cursor-pointer [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-[opacity,color,background-color] duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-1 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-1'
        }
      >
        <Star size={14} strokeWidth={2.25} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>

      {(onRename || onDelete) && (
        <div className="absolute top-1 left-1 flex gap-1">
          {onRename && (
            <button
              type="button"
              onClick={onRename}
              aria-label="Rename this saved template"
              title="Rename this saved template"
              className="p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-fg-faint cursor-pointer [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-[opacity,color,background-color] duration-quick ease-standard hover:text-fg-primary hover:bg-surface-1 focus-visible:outline-none focus-visible:text-fg-primary focus-visible:bg-surface-1"
            >
              <Pencil size={14} strokeWidth={2.25} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete this saved template"
              title="Delete this saved template"
              className="p-1 rounded-xs bg-surface-1/70 backdrop-blur-sm border border-edge-medium text-fg-faint cursor-pointer [@media(hover:hover)]:opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 transition-[opacity,color,background-color] duration-quick ease-standard hover:text-danger hover:bg-surface-1 focus-visible:outline-none focus-visible:text-danger focus-visible:bg-surface-1"
            >
              <Trash2 size={14} strokeWidth={2.25} />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
