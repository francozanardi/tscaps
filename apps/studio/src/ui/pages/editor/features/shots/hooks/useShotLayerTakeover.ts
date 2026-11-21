import { useMemo } from 'react';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { ShotLayerTakeoverReader, type ShotLayerTakeover } from '@presentation/shots/services/ShotLayerTakeoverReader';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What a layer's own CSS, `style`'s, has taken over from its panels; read again whenever the style changes. */
export function useShotLayerTakeover(style: ElementStyle | null): ShotLayerTakeover {
  const { styledElementCatalog, cssControlledFieldFinder, animationCssWriter } = useElements().services;
  const { cssParser } = useShots().services;
  const reader = useMemo(() => new ShotLayerTakeoverReader(
    cssControlledFieldFinder,
    styledElementCatalog.controlsFor('layer'),
    animationCssWriter,
    cssParser,
  ), [cssControlledFieldFinder, styledElementCatalog, animationCssWriter, cssParser]);
  return useMemo(() => reader.read(style), [reader, style]);
}
