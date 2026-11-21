import { useMemo } from 'react';
import { ShotLayerInsetTransitionForm } from '@presentation/shots/services/ShotLayerInsetTransitionForm';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** What the Motion tab says about a picture-in-picture box's transitions, for the caller's lifetime. */
export function useShotLayerInsetTransitionForm(): ShotLayerInsetTransitionForm {
  const { insetTransitions } = useShots().services;
  return useMemo(() => new ShotLayerInsetTransitionForm(insetTransitions), [insetTransitions]);
}
