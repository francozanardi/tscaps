import { memo, useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import { GraphicPresetGalleryLayout } from '@presentation/graphics/services/GraphicPresetGalleryLayout';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { CustomGraphicCard } from '@ui/pages/editor/features/graphics/components/CustomGraphicCard';
import { GraphicFieldsSection } from '@ui/pages/editor/features/graphics/components/GraphicFieldsSection';
import { GraphicPresetCard } from '@ui/pages/editor/features/graphics/components/GraphicPresetCard';
import { SaveGraphicPresetButton } from '@ui/pages/editor/features/graphics/components/SaveGraphicPresetButton';
import { SavedGraphicPresetDialogs, type SavedGraphicPresetEdit } from '@ui/pages/editor/features/graphics/components/SavedGraphicPresetDialogs';
import { useGraphicPresets } from '@ui/pages/editor/features/graphics/hooks/useGraphicPresets';
import { useEditorNavigationTelemetry } from '@ui/pages/editor/contexts/EditorNavigationTelemetryContext';
import { useShotLayerWholeReplay } from '@ui/pages/editor/features/shots/hooks/useShotLayerWholeReplay';

interface GraphicPresetsPanelProps {
  layer: ShotGraphicLayer;
  /** Whether the graphic sits on the video's first shot, where the hooks lead. */
  opening: boolean;
}

const ASIDE_CLASS = 'text-2xs text-fg-muted';
const CUSTOM_NAME = 'Custom';
const SEARCH_FIELD_CLASS =
  'group/search flex-1 min-w-0 flex items-center gap-2 h-[30px] px-2.5 bg-surface-2 border border-edge-medium rounded-xs '
  + 'transition-colors duration-quick ease-standard hover:border-edge-strong '
  + 'focus-within:border-accent focus-within:bg-surface-1 focus-within:ring-2 focus-within:ring-accent/30';
const GRID_CLASS = 'grid grid-cols-3 gap-1.5';

/**
 * What a graphic can start over from, and what it is. A search, and the
 * buttons that save the graphic as it stands — over the saved preset it
 * was made from, or as a new one; then, where the graphic is no preset (its code was edited, or
 * written for it), a *Custom* card standing for it as it is; then the
 * presets, the saved ones first and the shipped ones by family (the hooks
 * first on the video's first shot, last elsewhere), or as one
 * flat list while a search is typed. A saved preset can be renamed or
 * deleted from its card.
 *
 * Picking another preset puts it in place of the graphic, as it ships
 * (`SetShotGraphicAction.applyPreset`), and plays the layer through once
 * so the pick is seen in place; picking the one it already is only plays
 * it again, its field values kept. Pinned beneath, the fields the graphic
 * declares, under the name of the preset it is.
 */
export const GraphicPresetsPanel = memo(function GraphicPresetsPanel({ layer, opening }: GraphicPresetsPanelProps) {
  const { actions, services } = useShots();
  const presets = useGraphicPresets();
  const [layout] = useState(() => new GraphicPresetGalleryLayout());
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<SavedGraphicPresetEdit | null>(null);
  const replay = useShotLayerWholeReplay(layer.id);
  // Read on every render: a preset saved or deleted (which re-renders through `presets`) can change what the graphic is.
  const pickedPreset = services.graphicPresets.presetOf(layer.graphic);
  const savedOrigin = presets.find((preset) => preset.category === null && preset.id === layer.graphic.presetId) ?? null;
  const sections = useMemo(() => layout.build(presets, opening), [layout, presets, opening]);
  const found = useMemo(() => layout.search(presets, query), [layout, presets, query]);
  const navigationTelemetry = useEditorNavigationTelemetry();
  // Read once the reader leaves the field, so a half-typed word does not count as a search that found nothing.
  const reportSearch = () => {
    if (query.trim() !== '') navigationTelemetry.graphicPresetsSearched(found.length === 0);
  };

  // Picking the preset the graphic already is plays it again and changes nothing, as a motion or camera preset does;
  // starting it over is the header's reset.
  const pick = useCallback((preset: GraphicPreset) => {
    if (preset !== pickedPreset) actions.setGraphic.applyPreset(layer.id, preset);
    replay();
  }, [actions, layer.id, replay, pickedPreset]);
  const clearQuery = useCallback(() => setQuery(''), []);
  const closeEdit = useCallback(() => setEdit(null), []);

  const cardOf = (preset: GraphicPreset) => (
    <GraphicPresetCard
      key={preset.id}
      preset={preset}
      picked={preset === pickedPreset}
      onPick={() => pick(preset)}
      onRename={preset.category === null ? () => setEdit({ kind: 'rename', preset }) : undefined}
      onDelete={preset.category === null ? () => setEdit({ kind: 'delete', preset }) : undefined}
    />
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center gap-2 pt-3">
        <label className={SEARCH_FIELD_CLASS}>
          <Search size={13} className="text-fg-faint shrink-0 group-focus-within/search:text-fg-muted transition-colors duration-quick ease-standard" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={reportSearch}
            placeholder="Search presets"
            aria-label="Search presets"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-fg-secondary text-xs placeholder:text-fg-faint"
          />
        </label>
        <SaveGraphicPresetButton layerId={layer.id} savedOrigin={savedOrigin} suggestedName={pickedPreset?.name ?? ''} onSaved={clearQuery} />
      </div>
      {query.trim() !== '' ? (
        <Section title="Results">
          {found.length === 0
            ? <p className="m-0 py-4 text-center text-xs text-fg-muted">No presets match.</p>
            : <div className={GRID_CLASS}>{found.map(cardOf)}</div>}
        </Section>
      ) : (
        <>
          {pickedPreset === null && (
            <Section title={CUSTOM_NAME}>
              <div className={GRID_CLASS}>
                <CustomGraphicCard graphic={layer.graphic} onPick={replay} />
              </div>
            </Section>
          )}
          {sections.map((section) => (
            <Section key={section.id} title={section.label}>
              <div className={GRID_CLASS}>{section.presets.map(cardOf)}</div>
            </Section>
          ))}
        </>
      )}
      <div className="flex-1" />
      <GraphicFieldsSection layer={layer} titleAside={<span className={ASIDE_CLASS}>{pickedPreset?.name ?? CUSTOM_NAME}</span>} />
      <SavedGraphicPresetDialogs edit={edit} onClose={closeEdit} />
    </div>
  );
});
