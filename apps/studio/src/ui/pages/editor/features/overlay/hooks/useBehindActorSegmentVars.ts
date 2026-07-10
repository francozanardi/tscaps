import { useEffect, useMemo, useState } from 'react';
import type { Document, InlineStyleMap } from '@tscaps/engine';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

const NO_VARS: ReadonlyMap<string, InlineStyleMap> = new Map();

/**
 * Per-segment text-behind-actor CSS variables for the current project's
 * cached detector result, recomputed when the cache slot, the document,
 * or the user's per-segment overrides change. Resolves to an empty map
 * while no detector result is loaded — without masks the effect cannot
 * composite, so no segment should publish behind-actor state.
 */
export function useBehindActorSegmentVars(
  doc: Document,
  segmentOverrides: SegmentOverrides,
): ReadonlyMap<string, InlineStyleMap> {
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

  return useMemo(() => {
    if (entry === null) return NO_VARS;
    if (entry.projectId !== editor.store.snapshot().projectId) return NO_VARS;
    return personSegmentation.gatingService.buildSegmentInlineVars(
      doc,
      entry.result.windows,
      segmentOverrides.behindActorOverrides(),
    );
  }, [entry, doc, segmentOverrides, personSegmentation.gatingService, editor.store]);
}
