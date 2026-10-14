import { useEffect, useMemo, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

/** Where the text-behind-actor effect is on. */
export interface BehindActorActivation {
  /** Scenes behind the actor, whole. */
  readonly segmentIds: ReadonlySet<string>;
  /** Words behind the actor in a scene that is not. */
  readonly elementIds: ReadonlySet<string>;
}

const NOTHING_ACTIVE: BehindActorActivation = { segmentIds: new Set(), elementIds: new Set() };

/**
 * Where the text-behind-actor effect is on, for the current project's
 * cached detector result. Recomputed when the cache slot, the document,
 * the sheets, or the user's overrides change. Resolves to nothing while
 * no detector result is loaded — without masks the effect cannot
 * composite, so nothing should activate.
 */
export function useBehindActorActivation(
  doc: Document,
  sheets: Sheet[],
  behindActorOverrides: BehindActorOverrideRegistry,
): BehindActorActivation {
  const personSegmentation = usePersonSegmentation();
  const editor = useEditor();
  const [entry, setEntry] = useState(() => personSegmentation.loadedCacheStore.current);

  useEffect(() => {
    const store = personSegmentation.loadedCacheStore;
    const update = (): void => setEntry(store.current);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [personSegmentation.loadedCacheStore]);

  const templateConfigBySectionKind = useMemo(
    () => new Map<string, BehindActorTemplateConfig>(
      sheets.map((sheet) => [sheet.id, sheet.template.behindActor]),
    ),
    [sheets],
  );

  return useMemo(() => {
    if (entry === null) return NOTHING_ACTIVE;
    if (entry.projectId !== editor.store.snapshot().projectId) return NOTHING_ACTIVE;
    const gating = personSegmentation.gatingService;
    const overrides = behindActorOverrides.all();
    const segmentIds = gating.buildActiveSegmentIds(doc, entry.result.windows, overrides, templateConfigBySectionKind);
    return { segmentIds, elementIds: gating.buildActiveElementIds(doc, overrides, segmentIds) };
  }, [entry, doc, behindActorOverrides, templateConfigBySectionKind, personSegmentation.gatingService, editor.store]);
}
