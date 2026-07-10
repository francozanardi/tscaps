import type { ReactNode } from 'react';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import type { StyleOverrideFieldContext } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';

export interface RotationFieldShape {
  rotation?: number;
}

const ROTATION_MIN = -180;
const ROTATION_MAX = 180;
const ROTATION_STEP = 1;

export function rotationField<T extends RotationFieldShape>(
  { current, baseline, commit }: StyleOverrideFieldContext<T>,
): ReactNode {
  const value = current.rotation ?? baseline.rotation ?? 0;
  return (
    <Slider
      label="Rotation"
      value={value}
      min={ROTATION_MIN}
      max={ROTATION_MAX}
      step={ROTATION_STEP}
      unit="°"
      compact
      onChange={(v) => commit({ rotation: v } as Partial<T>)}
    />
  );
}
