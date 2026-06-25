import { useCallback, useMemo } from 'react';
import type { AlignmentConfig } from '@tscaps/engine';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import { StyleOverridesPanel, type StyleOverrideField } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';
import { fontSizeField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/FontSizeField';
import { positionField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/PositionField';
import { rotationField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/RotationField';

interface DecorationStyleOverridesPanelProps {
  /** Inherited alignment for the decoration — sheet + segment + placement default, with NO user override. Drives the position-field baseline. */
  inheritedAlignment: AlignmentConfig;
  currentOverrides: WordStyleOverrides;
  /** Inherited values for size and rotation — sheet + segment + host word styles. */
  baseline: Partial<WordStyleOverrides>;
  onCommit: (overrides: WordStyleOverrides) => void;
}

/** Style-override screen for an emoji glyph: size, rotation, position. */
export function DecorationStyleOverridesPanel({
  inheritedAlignment,
  currentOverrides,
  baseline,
  onCommit,
}: DecorationStyleOverridesPanelProps) {
  const positionBaseline = useMemo(
    () => ({
      verticalOffset: inheritedAlignment.verticalOffset,
      horizontalOffset: inheritedAlignment.horizontalOffset,
    }),
    [inheritedAlignment.verticalOffset, inheritedAlignment.horizontalOffset],
  );

  const positionFieldWithBaseline = useCallback<StyleOverrideField<WordStyleOverrides>>(
    ({ current, commit }) => positionField({ current, baseline: positionBaseline, commit }),
    [positionBaseline],
  );

  const fields = useMemo<ReadonlyArray<StyleOverrideField<WordStyleOverrides>>>(
    () => [fontSizeField, rotationField, positionFieldWithBaseline],
    [positionFieldWithBaseline],
  );

  return (
    <StyleOverridesPanel<WordStyleOverrides>
      title="Emoji style"
      current={currentOverrides}
      baseline={baseline}
      fields={fields}
      onCommit={onCommit}
    />
  );
}
