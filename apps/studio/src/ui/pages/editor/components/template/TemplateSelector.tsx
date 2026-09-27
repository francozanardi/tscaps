import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import { TEMPLATE_CATEGORIES } from '@core/templates/domain/TemplateCategory';
import {
  TemplateGalleryLayout,
  type TemplateGallerySectionId,
} from '@presentation/editor/services/TemplateGalleryLayout';
import { TemplateClipLibrary } from '@presentation/editor/services/TemplateClipLibrary';
import { NewTemplatePolicy } from '@presentation/editor/services/NewTemplatePolicy';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { TemplateCard } from '@ui/pages/editor/components/template/TemplateCard';
import { TemplateClipCard } from '@ui/pages/editor/components/template/TemplateClipCard';
import { TemplateGallerySection } from '@ui/pages/editor/components/template/TemplateGallerySection';

interface TemplateSelectorProps {
  templates: Template[];
  userTemplates: readonly Template[];
  selectedTemplate: Template | null;
  onSelect: (template: Template) => void;
  onDeleteUserTemplate: (id: string) => void;
  onRenameUserTemplate: (id: string) => void;
  library: TemplateLibraryView;
  /**
   * Per-section element rendered next to the section label, keyed by
   * section id. A section without an entry renders no adornment.
   * Search results and the empty state are not sections and do not
   * consult this map.
   */
  sectionAdornments?: Partial<Record<TemplateGallerySectionId, ReactNode>> | undefined;
}

// The panel's vertical rhythm. The gallery is the tab's whole body, so
// it sets its own top padding rather than sitting in a `Section` — the
// tab title's row is already 32px tall around a 16px title (its buttons
// set that height), so it arrives carrying half a gap of its own and a
// section's 18px on top of that is what made the field look adrift.
//
// The field belongs to the title above it and the families below are
// what it filters, so the gap under it is the larger of the two, and it
// matches the gap between families: the search is a peer of the section
// headers, not a lid on the first one.
const HEADER_TO_SEARCH_PADDING = 'pt-2';
const SEARCH_TO_BODY_GAP = 'gap-6';
// Families are separated by a hairline rather than by more space: at
// 24px the gap was already the widest in the panel and still did not
// read, because a section's header carries the same weight as every
// other label in the sidebar. The rule is the one `Section` uses to
// separate blocks elsewhere, and it lives on the list rather than on a
// section, since a section shown on its own has nothing to divide from.
// Padding on both sides keeps the line centred in the same 24px.
const BETWEEN_SECTIONS_DIVIDERS =
  '[&>section+section]:border-t [&>section+section]:border-edge-subtle ' +
  '[&>section+section]:pt-3 [&>section:not(:last-child)]:pb-3';
const BACK_LINK_GAP = 'gap-4';

const SEARCH_FIELD_CLASS =
  'group/search flex items-center gap-2 h-[30px] px-2.5 bg-surface-2 border border-edge-medium rounded-xs ' +
  'transition-colors duration-quick ease-standard hover:border-edge-strong ' +
  'focus-within:border-accent focus-within:bg-surface-1 focus-within:ring-2 focus-within:ring-accent/30';

const BACK_BUTTON_CLASS =
  'inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer ' +
  'font-mono text-2xs uppercase tracking-[0.08em] text-fg-faint ' +
  'transition-colors duration-quick ease-standard hover:text-fg-secondary ' +
  'focus-visible:outline-none focus-visible:text-fg-secondary';

/**
 * Picker for the active template. Browses by family — one section each,
 * every section openable in full — and collapses to a single ranked list
 * as soon as anything is typed into the search field.
 */
export const TemplateSelector = memo(function TemplateSelector({
  templates,
  userTemplates,
  selectedTemplate,
  onSelect,
  onDeleteUserTemplate,
  onRenameUserTemplate,
  library,
  sectionAdornments,
}: TemplateSelectorProps) {
  const [query, setQuery] = useState('');
  const [openedSectionId, setOpenedSectionId] = useState<TemplateGallerySectionId | null>(null);

  const [layout] = useState(() => new TemplateGalleryLayout());
  const [clips] = useState(() => new TemplateClipLibrary(import.meta.env.BASE_URL));
  const [newTemplatePolicy] = useState(() => new NewTemplatePolicy(new CalendarDateParser(), new Date()));

  const newTemplateIds = useMemo(
    () => new Set(templates.filter((t) => newTemplatePolicy.isNew(t)).map((t) => t.metadata.id)),
    [templates, newTemplatePolicy],
  );

  const userTemplateIds = useMemo(
    () => new Set(userTemplates.map((t) => t.metadata.id)),
    [userTemplates],
  );

  const galleryInput = useMemo(
    () => ({
      builtins: templates,
      userTemplates,
      favoriteIds: library.favorites,
    }),
    [templates, userTemplates, library.favorites],
  );

  const sections = useMemo(() => layout.build(galleryInput), [layout, galleryInput]);
  const searchResults = useMemo(() => layout.search(galleryInput, query), [layout, galleryInput, query]);

  // A section can empty out while it is open (its last favorite removed,
  // its last saved template deleted); falling back to the gallery keeps
  // the panel from going blank.
  const openedSection = sections.find((section) => section.id === openedSectionId) ?? null;

  const closeSection = useCallback(() => setOpenedSectionId(null), []);
  const openSection = useCallback((id: TemplateGallerySectionId) => setOpenedSectionId(id), []);

  const renderCard = useCallback(
    (template: Template) => {
      const isSelected = selectedTemplate?.metadata.id === template.metadata.id;
      const isFavorite = library.favorites.has(template.metadata.id);
      const isUserTemplate = userTemplateIds.has(template.metadata.id);
      const isNew = newTemplateIds.has(template.metadata.id);
      // A saved template is the user's own edit of its parent, so the
      // parent's clip would show them something they did not save.
      const showsClip = !isUserTemplate
        && TEMPLATE_CATEGORIES[template.metadata.category].preview === 'clip';
      if (showsClip) {
        const clip = clips.clipFor(template.metadata.id);
        return (
          <TemplateClipCard
            key={template.metadata.id}
            template={template}
            clipUrl={clip.clipUrl}
            posterUrl={clip.posterUrl}
            objectPosition={clip.objectPosition}
            isSelected={isSelected}
            isFavorite={isFavorite}
            isNew={isNew}
            onSelect={onSelect}
            onToggleFavorite={library.toggleFavorite}
          />
        );
      }
      return (
        <TemplateCard
          key={template.metadata.id}
          template={template}
          isSelected={isSelected}
          isFavorite={isFavorite}
          isNew={isNew}
          onSelect={onSelect}
          onToggleFavorite={library.toggleFavorite}
          onDelete={isUserTemplate ? () => onDeleteUserTemplate(template.metadata.id) : undefined}
          onRename={isUserTemplate ? () => onRenameUserTemplate(template.metadata.id) : undefined}
        />
      );
    },
    [selectedTemplate, library, userTemplateIds, newTemplateIds, clips, onSelect, onDeleteUserTemplate, onRenameUserTemplate],
  );

  return (
    <div className={`flex flex-col ${SEARCH_TO_BODY_GAP} ${HEADER_TO_SEARCH_PADDING} pb-2`}>
      <div className={SEARCH_FIELD_CLASS}>
        <Search size={13} className="text-fg-faint shrink-0 group-focus-within/search:text-fg-muted transition-colors duration-quick ease-standard" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-fg-secondary text-xs placeholder:text-fg-faint"
        />
      </div>

      {query.trim() !== '' ? (
        searchResults.length === 0 ? (
          <div className="p-6 text-center text-fg-muted text-sm">No templates match.</div>
        ) : (
          <TemplateGallerySection
            id="saved"
            label="Results"
            templates={searchResults}
            rows={null}
            newTemplateIds={newTemplateIds}
            renderCard={renderCard}
          />
        )
      ) : openedSection ? (
        <div className={`flex flex-col ${BACK_LINK_GAP}`}>
          <button type="button" onClick={closeSection} className={BACK_BUTTON_CLASS}>
            <ChevronLeft size={12} strokeWidth={2.5} />
            <span>All templates</span>
          </button>
          <TemplateGallerySection
            id={openedSection.id}
            label={openedSection.label}
            templates={openedSection.templates}
            rows={null}
            headerAdornment={sectionAdornments?.[openedSection.id]}
            newTemplateIds={newTemplateIds}
            renderCard={renderCard}
          />
        </div>
      ) : (
        <div className={`flex flex-col ${BETWEEN_SECTIONS_DIVIDERS}`}>
          {sections.map((section) => (
            <TemplateGallerySection
              key={section.id}
              id={section.id}
              label={section.label}
              templates={section.templates}
              rows={section.previewRows}
              onViewAll={openSection}
              headerAdornment={sectionAdornments?.[section.id]}
              newTemplateIds={newTemplateIds}
              renderCard={renderCard}
            />
          ))}
        </div>
      )}
    </div>
  );
});
