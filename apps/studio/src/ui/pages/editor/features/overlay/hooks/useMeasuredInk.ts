import { useLayoutEffect, type RefObject } from 'react';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

/**
 * Publishes on a line how far its glyphs reach above and below its
 * baseline, as multiples of the font size it renders at, under the two
 * ink properties the export publishes too.
 *
 * Re-read whenever the line's box resizes: the text, the face and the
 * size all move the box when they change the ink, and a face that
 * arrives late resizes it as it replaces the fallback. Read as the export
 * reads it, through the same reader.
 *
 * The preview's own answer to what the engine measures for export
 * against an offline probe.
 */
export function useMeasuredInk(ref: RefObject<HTMLElement | null>, enabled: boolean = true): void {
  const { glyphInkReader, constants } = useEngine();
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;

    let published: string | null = null;
    const publish = (): void => {
      const ink = glyphInkReader.extentsEm(element);
      const value = ink ? `${ink.ascentEm} ${ink.descentEm}` : null;
      if (value === published) return;
      published = value;
      if (!ink) {
        element.style.removeProperty(constants.LINE_INK_ASCENT_EM_VARIABLE);
        element.style.removeProperty(constants.LINE_INK_DESCENT_EM_VARIABLE);
        return;
      }
      element.style.setProperty(constants.LINE_INK_ASCENT_EM_VARIABLE, String(ink.ascentEm));
      element.style.setProperty(constants.LINE_INK_DESCENT_EM_VARIABLE, String(ink.descentEm));
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, [ref, enabled, glyphInkReader, constants]);
}
