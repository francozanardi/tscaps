import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { RestingCaptionProbe } from '@presentation/editor/services/RestingCaptionProbe';
import type { RestingElementStyle } from '@presentation/editor/services/RestingElementStyle';
import { useRestingCaptionProbe } from '@ui/pages/editor/contexts/RestingCaptionProbeContext';
import { useCaptionPaintState } from '@ui/pages/editor/features/overlay/hooks/useCaptionPaintState';

const NOTHING_TO_UNSUBSCRIBE = (): void => {};

/** A reading, with the element it was taken for. */
interface ElementReading {
  readonly elementId: string;
  readonly style: RestingElementStyle;
}

/**
 * What the browser resolves for a word at rest, read off a copy of its
 * caption: `properties` on the word and on the line it sits in. `null`
 * for anything that is not a word, and outside an editor.
 *
 * Read after the DOM has been written, never while deciding what to
 * write. The stylesheets the copy is laid out under are written in the
 * same commit as the edit that changed them, so a read taken while
 * rendering would describe the word as it was before that edit. The
 * update that follows lands before the browser paints, so the first
 * value on screen is already the measured one.
 *
 * Read again once the captions get a box to be laid out in, and once a
 * gesture reshaping them ends. While a gesture runs, or before there is
 * a box, the last reading of the same element stands; one taken for
 * another element never does.
 *
 * `properties` must keep its identity across renders.
 */
export function useRestingElementStyle(
  elementId: string,
  kind: ElementKind,
  sheet: Sheet | null,
  properties: ReadonlyArray<string>,
): RestingElementStyle | null {
  const probe = useRestingCaptionProbe();
  const painted = useCaptionPaintState();
  const readable = useProbeReadiness(probe);
  const [reading, setReading] = useState<ElementReading | null>(null);

  // `painted` carries every element's style, which reaches the word
  // through the stylesheets the copy is laid out under rather than here:
  // any write to it is a reason to read again.
  useLayoutEffect(() => {
    if (kind !== 'word' || !probe || !sheet || !painted) {
      setReading(null);
      return;
    }
    if (!readable) return;
    const next = probe.read(painted, sheet, elementId, properties);
    setReading((previous) => {
      if (next === null) return null;
      return previous?.elementId === elementId && next.equals(previous.style) ? previous : { elementId, style: next };
    });
  }, [probe, readable, kind, sheet, painted, elementId, properties]);

  return reading?.elementId === elementId ? reading.style : null;
}

function useProbeReadiness(probe: RestingCaptionProbe | null): boolean {
  const subscribe = useCallback(
    (notify: () => void) => (probe ? probe.subscribe(notify) : NOTHING_TO_UNSUBSCRIBE),
    [probe],
  );
  return useSyncExternalStore(subscribe, () => probe?.canRead() ?? false);
}
