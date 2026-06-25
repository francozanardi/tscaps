import { useEffect, useState } from 'react';
import { useCutsEditingController } from '@ui/pages/editor/features/cuts/contexts/CutsEditingContext';
import type {
  CutsCutEdit,
  CutsSelection,
} from '@presentation/cuts/controllers/CutsEditingController';

/** Reactive read of the in-progress cuts selection (or null). */
export function useCutsSelection(): CutsSelection | null {
  const controller = useCutsEditingController();
  const [value, setValue] = useState<CutsSelection | null>(() => controller.selection);
  useEffect(() => {
    const update = () => setValue(controller.selection);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return value;
}

/** Reactive read of the in-progress cut edge-drag preview (or null). */
export function useCutsCutEdit(): CutsCutEdit | null {
  const controller = useCutsEditingController();
  const [value, setValue] = useState<CutsCutEdit | null>(() => controller.cutEdit);
  useEffect(() => {
    const update = () => setValue(controller.cutEdit);
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return value;
}
