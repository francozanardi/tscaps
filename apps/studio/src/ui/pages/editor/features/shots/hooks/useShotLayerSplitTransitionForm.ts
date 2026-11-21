import { useMemo } from 'react';
import { ShotLayerSplitTransitionForm } from '@presentation/shots/services/ShotLayerSplitTransitionForm';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What the Motion tab says about a split's transitions, for the caller's lifetime. */
export function useShotLayerSplitTransitionForm(): ShotLayerSplitTransitionForm {
  const { splitTransitions } = useShots().services;
  return useMemo(() => new ShotLayerSplitTransitionForm(splitTransitions), [splitTransitions]);
}
