import { useMemo } from 'react';
import { ShotLayerMotionForm } from '@presentation/shots/services/ShotLayerMotionForm';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';

/** The settings a shot layer's entrance and exit are offered by, for the caller's lifetime. */
export function useShotLayerMotionForm(): ShotLayerMotionForm {
  const { animationCatalog, timingVariableResolver } = useElements().services;
  return useMemo(() => new ShotLayerMotionForm(animationCatalog, timingVariableResolver), [animationCatalog, timingVariableResolver]);
}
