import { useMemo } from 'react';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

/**
 * The alphabets one element's own text is written in, the one it holds
 * most characters of first. Always at least one.
 *
 * `sheet` settles the language rather than the script: only the captions
 * around a word can say whether the Arabic letters in it are Urdu.
 */
export function useElementScripts(elementId: string, sheet: Sheet | null): ReadonlyArray<FontFaceSlot> {
  const { scriptRowResolver, elementCaptionTextCollector } = useRendering();
  const { document } = useEditorState();
  return useMemo(() => {
    const text = document === null ? '' : elementCaptionTextCollector.collect(document, elementId);
    return scriptRowResolver.resolve(text, sheet?.scripts.readsAsUrdu ?? false);
  }, [document, elementId, sheet?.scripts.readsAsUrdu, scriptRowResolver, elementCaptionTextCollector]);
}
