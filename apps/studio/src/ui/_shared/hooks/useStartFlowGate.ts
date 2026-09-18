import { useEffect, useState } from 'react';
import { usePreprocessing } from '@ui/_shared/contexts/modules/PreprocessingContext';

/**
 * Whether the start flow is the surface in charge: a video is loaded,
 * nothing has been produced from it yet, and no run is in flight.
 * Re-renders when that stops being true.
 */
export function useStartFlowGate(): boolean {
  const { flow } = usePreprocessing();
  const [open, setOpen] = useState<boolean>(() => flow.dialogOpen);

  useEffect(() => {
    const update = () => setOpen(flow.dialogOpen);
    flow.addEventListener('change', update);
    update();
    return () => flow.removeEventListener('change', update);
  }, [flow]);

  return open;
}
