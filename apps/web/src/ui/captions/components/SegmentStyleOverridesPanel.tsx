import { useMemo } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentStyleOverrides } from '@core/editor/domain/SegmentStyleOverrides';
import { StyleOverridesPanel, type StyleOverrideField } from '@ui/captions/components/StyleOverridesPanel';
import { styleTogglesField } from '@ui/captions/components/styleOverrideFields/StyleTogglesField';
import { fontFamilyField } from '@ui/captions/components/styleOverrideFields/FontFamilyField';
import { fontSizeField } from '@ui/captions/components/styleOverrideFields/FontSizeField';
import { fontWeightField } from '@ui/captions/components/styleOverrideFields/FontWeightField';
import { colorField } from '@ui/captions/components/styleOverrideFields/ColorField';
import { positionField } from '@ui/captions/components/styleOverrideFields/PositionField';
import { rotationField } from '@ui/captions/components/styleOverrideFields/RotationField';

interface SegmentStyleOverridesPanelProps {
  sheet: Sheet;
  currentOverrides: SegmentStyleOverrides;
  onCommit: (overrides: SegmentStyleOverrides) => void;
}

const FIELDS: ReadonlyArray<StyleOverrideField<SegmentStyleOverrides>> = [
  styleTogglesField,
  fontFamilyField,
  fontSizeField,
  fontWeightField,
  colorField,
  positionField,
  rotationField,
];

/**
 * Segment-level style overrides screen, mounted by `SegmentSettingsPopover`
 * as the "styles" screen. Composes `StyleOverridesPanel` with the same
 * typography fields used by the word panel plus the segment-only
 * `positionField` (vertical / horizontal offsets). The baseline flattens
 * the sheet's typography and the two alignment offsets so the per-key
 * cleaning rule drops a slider that returns to the sheet value.
 */
export function SegmentStyleOverridesPanel({
  sheet,
  currentOverrides,
  onCommit,
}: SegmentStyleOverridesPanelProps) {
  const baseline = useMemo<Partial<SegmentStyleOverrides>>(() => ({
    ...sheet.typographyConfig,
    verticalOffset: sheet.alignmentConfig.verticalOffset,
    horizontalOffset: sheet.alignmentConfig.horizontalOffset,
    rotation: sheet.rotationConfig.angleDeg,
  }), [sheet.typographyConfig, sheet.alignmentConfig, sheet.rotationConfig]);

  return (
    <StyleOverridesPanel<SegmentStyleOverrides>
      title="Style overrides"
      current={currentOverrides}
      baseline={baseline}
      fields={FIELDS}
      onCommit={onCommit}
    />
  );
}
