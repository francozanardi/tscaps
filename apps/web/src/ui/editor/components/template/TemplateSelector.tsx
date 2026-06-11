import { memo, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import { TemplateCard } from '@ui/editor/components/template/TemplateCard';
import { TemplateTabStrip, type TemplateTab } from '@ui/editor/components/template/TemplateTabStrip';

interface TemplateSelectorProps {
  templates: Template[];
  userTemplates: readonly Template[];
  selectedTemplate: Template | null;
  onSelect: (template: Template) => void;
  onDeleteUserTemplate: (id: string) => void;
  onRenameUserTemplate: (id: string) => void;
  library: TemplateLibraryView;
}

/** Built-in tab ids; user categories are appended after these. */
type BuiltinTab = 'all' | 'favorites';
type TabId = BuiltinTab | string;

/**
 * Picker for the active template. Owns the search field and the tab strip
 * (built-ins + per-category tabs from each template's `categories`). All
 * matching templates are rendered — the surrounding sidebar handles scroll.
 */
export const TemplateSelector = memo(function TemplateSelector({
  templates,
  userTemplates,
  selectedTemplate,
  onSelect,
  onDeleteUserTemplate,
  onRenameUserTemplate,
  library,
}: TemplateSelectorProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('all');

  const userTemplateIds = useMemo(
    () => new Set(userTemplates.map((t) => t.metadata.id)),
    [userTemplates],
  );

  // User templates render before built-ins; tabs are derived from the
  // union so categories carried only by user templates (e.g. the
  // implicit "my templates") still surface.
  const combinedTemplates = useMemo<Template[]>(
    () => [...userTemplates, ...templates],
    [userTemplates, templates],
  );

  const tabs = useMemo<TemplateTab[]>(() => {
    const result: TemplateTab[] = [{ id: 'all', label: 'All' }];
    if (library.favorites.size > 0) result.push({ id: 'favorites', label: 'Favorites' });
    const seen = new Set<string>();
    for (const t of combinedTemplates) {
      for (const c of t.metadata.categories) {
        if (seen.has(c)) continue;
        seen.add(c);
        result.push({ id: c, label: titleCase(c) });
      }
    }
    return result;
  }, [combinedTemplates, library.favorites]);

  // Active tab can vanish (favorites cleared, category emptied); fall back to "All".
  const effectiveTab: TabId = tabs.some((t) => t.id === activeTab) ? activeTab : 'all';

  const tabFiltered = useMemo<Template[]>(() => {
    if (effectiveTab === 'all') return combinedTemplates;
    if (effectiveTab === 'favorites') return combinedTemplates.filter((t) => library.favorites.has(t.metadata.id));
    return combinedTemplates.filter((t) => t.metadata.categories.includes(effectiveTab));
  }, [combinedTemplates, effectiveTab, library.favorites]);

  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabFiltered;
    return tabFiltered.filter((t) => t.metadata.name.toLowerCase().includes(q));
  }, [tabFiltered, query]);

  // Favorites float to the top of every bucket. `sort` is stable in
  // modern engines, so non-favorites preserve their incoming order
  // (user templates: updatedAt-desc from TemplatesTab; built-ins:
  // declaration order).
  const filtered = useMemo<Template[]>(() => {
    const favorites = library.favorites;
    return [...queryFiltered].sort((a, b) => {
      const aFav = favorites.has(a.metadata.id) ? 1 : 0;
      const bFav = favorites.has(b.metadata.id) ? 1 : 0;
      return bFav - aFav;
    });
  }, [queryFiltered, library.favorites]);

  const allTabSplit = useMemo(() => {
    if (effectiveTab !== 'all') return null;
    const user: Template[] = [];
    const builtin: Template[] = [];
    for (const t of filtered) {
      (userTemplateIds.has(t.metadata.id) ? user : builtin).push(t);
    }
    return { user, builtin };
  }, [filtered, effectiveTab, userTemplateIds]);

  const hasGrid = filtered.length > 0;

  const renderCard = (template: Template) => {
    const isUserTemplate = userTemplateIds.has(template.metadata.id);
    return (
      <TemplateCard
        key={template.metadata.id}
        template={template}
        isSelected={selectedTemplate?.metadata.id === template.metadata.id}
        isFavorite={library.favorites.has(template.metadata.id)}
        onSelect={onSelect}
        onToggleFavorite={library.toggleFavorite}
        onDelete={isUserTemplate ? () => onDeleteUserTemplate(template.metadata.id) : undefined}
        onRename={isUserTemplate ? () => onRenameUserTemplate(template.metadata.id) : undefined}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2.5 pb-2">
      <div className="group/search flex items-center gap-2 h-[30px] px-2.5 bg-surface-2 border border-edge-medium rounded-xs transition-colors duration-quick ease-standard hover:border-edge-strong focus-within:border-accent focus-within:bg-surface-1 focus-within:ring-2 focus-within:ring-accent/30">
        <Search size={13} className="text-fg-faint shrink-0 group-focus-within/search:text-fg-muted transition-colors duration-quick ease-standard" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-fg-secondary text-xs placeholder:text-fg-faint"
        />
      </div>

      <TemplateTabStrip tabs={tabs} activeId={effectiveTab} onSelect={setActiveTab} />

      {!hasGrid ? (
        <div className="p-6 text-center text-fg-muted text-sm">
          No templates match.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] gap-2">
          {allTabSplit ? (
            <>
              {allTabSplit.user.map(renderCard)}
              {allTabSplit.user.length > 0 && allTabSplit.builtin.length > 0 && (
                <hr
                  className="border-0 border-t border-edge-subtle my-1"
                  style={{ gridColumn: '1 / -1' }}
                />
              )}
              {allTabSplit.builtin.map(renderCard)}
            </>
          ) : (
            filtered.map(renderCard)
          )}
        </div>
      )}
    </div>
  );
});

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
