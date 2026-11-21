import { useMemo } from 'react';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { ShotLayerPlacementForm } from '@presentation/shots/services/ShotLayerPlacementForm';

/** The settings a shot layer's layout is offered by. */
export function useShotLayerPlacementForm(): ShotLayerPlacementForm {
  return useMemo(() => new ShotLayerPlacementForm(new ShotLayerPlacementSanitizer(), new ShotLayerBoxShape()), []);
}
