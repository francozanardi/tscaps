import { memo } from 'react';
import type { RotationConfig } from '@core/sheets/domain/RotationConfig';
import { Section } from '@ui/editor/components/controls/Section';
import { Slider } from '@ui/editor/components/controls/Slider';

interface RotationSectionProps {
  config: RotationConfig;
  onChange: (patch: Partial<RotationConfig>) => void;
  /** When true, the Section header is omitted (the surrounding tab provides the title). */
  hideTitle?: boolean | undefined;
}

const ROTATION_MIN = -180;
const ROTATION_MAX = 180;
const ROTATION_STEP = 1;

/**
 * Custom widget for `RotationConfig`. A single degree slider drives
 * `angleDeg`. Reuses the shared `Slider` atom and the `Section` shell
 * for visual consistency with `PositionSection` and `TypographySection`.
 */
export const RotationSection = memo(function RotationSection({
  config,
  onChange,
  hideTitle,
}: RotationSectionProps) {
  return (
    <Section title={hideTitle ? undefined : 'Rotation'}>
      <Slider
        label="Angle"
        value={config.angleDeg}
        min={ROTATION_MIN}
        max={ROTATION_MAX}
        step={ROTATION_STEP}
        unit="°"
        onChange={(v) => onChange({ angleDeg: v })}
      />
    </Section>
  );
});
