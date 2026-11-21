import { useCallback, useSyncExternalStore } from 'react';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What the graphic of `layerId` said lately, oldest first, re-read as it says more. */
export function useGraphicMessages(layerId: string): ReadonlyArray<GraphicMessage> {
  const { services } = useShots();
  const log = services.graphicMessages;
  const read = useCallback(() => log.of(layerId), [log, layerId]);
  return useSyncExternalStore(useCallback((listener) => log.subscribe(listener), [log]), read, read);
}
