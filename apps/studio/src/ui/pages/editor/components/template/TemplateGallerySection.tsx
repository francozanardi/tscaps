import { memo, useRef, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateGallerySectionId } from '@presentation/editor/services/TemplateGalleryLayout';
import { useGridColumnCount } from '@ui/_shared/hooks/useGridColumnCount';

interface TemplateGallerySectionProps {
  id: TemplateGallerySectionId;
  label: string;
  templates: readonly Template[];
  /**
   * Rows to show before the *View all* link, or `null` to show every
   * template the section holds. How many cards that is depends on the
   * width the panel happens to have.
   */
  rows: number | null;
  /** Handed this section's id, so one callback serves every section. */
  onViewAll?: ((id: TemplateGallerySectionId) => void) | undefined;
  /**
   * Optional element rendered next to the section label. Sized to sit
   * beside a `text-2xs` heading — an icon-sized affordance, not a badge.
   */
  headerAdornment?: ReactNode;
  /** Templates marked as new; one cut off by the row budget puts a dot on *View all*. */
  newTemplateIds: ReadonlySet<string>;
  renderCard: (template: Template) => ReactNode;
}

// Every section resolves the same columns, whatever it shows in them: a
// clip and a caption tile of different widths would read as two grids
// stacked, and the panel is resizable so the widths have to agree at
// every size rather than at one. 110px is what fits three across the
// panel's default width, which is also about where a 4:5 clip's caption
// stops being readable.
//
// `items-start` because a section can hold both kinds at once — Favorites
// does — and a row is as tall as its tallest card. Stretched, a caption
// tile beside a clip would grow to three times its own height.
const GALLERY_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(min(110px,100%),1fr))] gap-2 items-start';

const VIEW_ALL_CLASS =
  'shrink-0 inline-flex items-center gap-0.5 bg-transparent border-none p-0 cursor-pointer ' +
  'font-mono text-2xs uppercase tracking-[0.08em] text-fg-faint ' +
  'transition-colors duration-quick ease-standard hover:text-fg-secondary ' +
  'focus-visible:outline-none focus-visible:text-fg-secondary';

const HIDDEN_NEW_DOT = 'inline-block w-[5px] h-[5px] rounded-full bg-accent shrink-0';

/**
 * One family's block in the gallery: its name, the cards that fit in the
 * row budget it was given, and a link into the rest when the budget cut
 * some off. Owns the grid, so what a card's width is stays one decision
 * across every section.
 */
export const TemplateGallerySection = memo(function TemplateGallerySection({
  id,
  label,
  templates,
  rows,
  onViewAll,
  headerAdornment,
  newTemplateIds,
  renderCard,
}: TemplateGallerySectionProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const columnCount = useGridColumnCount(gridRef);

  const shown = rows === null ? templates : templates.slice(0, rows * columnCount);
  const hasMore = shown.length < templates.length;
  const hidesNew = templates.slice(shown.length).some((template) => newTemplateIds.has(template.metadata.id));

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-muted m-0 truncate">
            {label}
          </h3>
          {headerAdornment}
        </div>
        {hasMore && onViewAll && (
          <button type="button" onClick={() => onViewAll(id)} className={VIEW_ALL_CLASS}>
            {hidesNew && <span className={HIDDEN_NEW_DOT} title="Includes new templates" />}
            <span>View all {templates.length}</span>
            <ChevronRight size={12} strokeWidth={2.5} />
          </button>
        )}
      </header>
      <div ref={gridRef} className={GALLERY_GRID}>
        {shown.map((template) => renderCard(template))}
      </div>
    </section>
  );
});
