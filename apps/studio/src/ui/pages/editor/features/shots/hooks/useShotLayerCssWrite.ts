import { useMemo } from 'react';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import type { ElementCssWrite } from '@ui/pages/editor/features/element/ElementCodePanel';

/** Writes the text the Code tab holds into a shot layer's own style, the same object for as long as the shots module lives. */
export function useShotLayerCssWrite(): ElementCssWrite {
  const { actions } = useShots();
  return useMemo(() => ({ execute: (layerId: string, _kind: string, css: string) => actions.setLayerCss.execute(layerId, css) }), [actions]);
}
