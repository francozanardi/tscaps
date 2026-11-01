import { useMemo } from 'react';
import type { CaptionPaintState } from '@presentation/editor/services/RestingCaptionProbe';
import { useBehindActorActivation } from '@ui/pages/editor/features/overlay/hooks/useBehindActorActivation';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

/**
 * What the overlay paints captions from, derived from the editor's
 * state by the same calls the overlay's own derivation makes: the
 * document with the words a cut removed left out, where each element
 * sits, and where the text-behind-actor effect is on. `null` while
 * there is no document.
 *
 * Changes identity whenever any of it does, so a reading that depends
 * on it knows when to be taken again.
 */
export function useCaptionPaintState(): CaptionPaintState | null {
  const { document, cuts, sheets, behindActorOverrides, elementStyles } = useEditorState();
  const { cutAwareDocumentBuilder } = useCuts().services;
  const painted = useMemo(
    () => (document ? cutAwareDocumentBuilder.build(document, cuts) : null),
    [cutAwareDocumentBuilder, document, cuts],
  );
  const behindActor = useBehindActorActivation(painted, sheets, behindActorOverrides);
  return useMemo(
    () => (painted
      ? {
        document: painted,
        elementStyles,
        behindActorSegmentIds: behindActor.segmentIds,
        behindActorElementIds: behindActor.elementIds,
      }
      : null),
    [painted, elementStyles, behindActor],
  );
}
