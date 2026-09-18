import { useMemo } from 'react';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

/**
 * The alphabets a sheet's captions are written in, the one they hold
 * most characters of first. Always at least one.
 *
 * What a font control offers a picker for: a sheet whose captions are in
 * one alphabet asks for one face, and one that mixes two asks for two.
 */
export function useSheetScripts(sheet: Sheet): ReadonlyArray<FontFaceSlot> {
  const { scriptRowResolver, captionTextCollector } = useRendering();
  const { document } = useEditorState();
  return useMemo(() => {
    const text = document === null ? '' : captionTextCollector.collect(document, sheet.id);
    return scriptRowResolver.resolve(text, sheet.scripts.readsAsUrdu);
  }, [document, sheet.id, sheet.scripts.readsAsUrdu, scriptRowResolver, captionTextCollector]);
}
