import { memo, useCallback, useRef, useState } from 'react';
import { Check, Star, Trash2, Pencil } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import { TemplatePreviewFrame } from '@ui/_shared/components/TemplatePreview/TemplatePreviewFrame';

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

// Every card carries a scoped stylesheet, SVG filter defs, the template's
// full DOM tree, and two ResizeObservers. Rendering the whole gallery at
// once pushes low-memory mobile browsers past the borderline OOM. The
// browser skips render for cards outside the viewport; the intrinsic size
// keeps the scrollbar stable until each card is first painted.
const OFFSCREEN_RENDER_SKIP_CLASS = '[content-visibility:auto] [contain-intrinsic-size:auto_120px]';

// Selection reads the same here as it does on a clip card and in the
// asset picker: the accent edge plus a halo, and a mark that survives
// whatever the card is showing behind it.
const FRAME_BASE =
  'w-full bg-transparent border-[1.5px] rounded-md cursor-pointer flex flex-col overflow-hidden p-0 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none';
const FRAME_SELECTED = 'border-accent';
const FRAME_IDLE =
  'border-edge-subtle hover:border-edge-strong focus-visible:border-accent ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40';
const ACTIVE_BADGE =
  'absolute bottom-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded-full ' +
  'bg-accent text-fg-on-accent pointer-events-none';


export const TemplateCard = memo(function TemplateCard({
  template,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  onDelete,
  onRename,
}: TemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  // Hover host on the wrapper (not the inner button) so the favorite overlay doesn't break hover.
  const hostRef = useRef<HTMLDivElement>(null);

  // Stable so the rAF effect inside TemplatePreviewAnimated doesn't reset
  // every render of the card.
  const onHoverLost = useCallback(() => setIsHovered(false), []);

  return (
    <div
      ref={hostRef}
      className={`relative group/card ${OFFSCREEN_RENDER_SKIP_CLASS}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className={isSelected ? `${FRAME_BASE} ${FRAME_SELECTED}` : `${FRAME_BASE} ${FRAME_IDLE}`}
        onClick={() => onSelect(template)}
        aria-label={template.metadata.name}
        aria-pressed={isSelected}
      >
        <TemplatePreviewFrame
          template={template}
          isHovered={isHovered}
          hostRef={hostRef}
          onHoverLost={onHoverLost}
          aspectClass="aspect-[4/2]"
        />
      </button>

      {isSelected && (
        <span className={ACTIVE_BADGE}>
          <Check size={10} strokeWidth={3} />
        </span>
      )}

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
