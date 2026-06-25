import { useEffect, useState } from 'react';
import { useCutsWaveformController } from '@ui/pages/editor/features/cuts/contexts/CutsWaveformContext';
import type { CutsWaveformState } from '@presentation/cuts/controllers/CutsWaveformController';

/** Reactive read of the cuts waveform extraction state. */
export function useCutsWaveformState(): CutsWaveformState {
  const controller = useCutsWaveformController();
  const [value, setValue] = useState<CutsWaveformState>(() => controller.state);
  useEffect(() => {
    const update = () => setValue(controller.state);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return value;
}
