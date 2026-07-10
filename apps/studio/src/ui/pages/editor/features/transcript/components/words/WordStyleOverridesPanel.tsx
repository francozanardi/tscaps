import { useCallback, useMemo } from 'react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import { StyleOverridesPanel, type StyleOverrideField } from '@ui/pages/editor/features/transcript/components/style-overrides/StyleOverridesPanel';
import { styleTogglesField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/StyleTogglesField';
import { fontFamilyField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/FontFamilyField';
import { fontSizeField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/FontSizeField';
import { fontWeightField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/FontWeightField';
import { colorField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/ColorField';
import { positionField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/PositionField';
import { rotationField } from '@ui/pages/editor/features/transcript/components/style-overrides/fields/RotationField';
import { measureWordAnchorFraction } from '@ui/pages/editor/features/overlay/wordPositionProbe';
import { useWordStyleBaselineResolver } from '@ui/pages/editor/contexts/WordStyleBaselineContext';

interface WordStyleOverridesPanelProps {
  sheet: Sheet;
  segment: Segment;
  segmentOverrides: SegmentOverrides;
  word: Word;
  currentOverrides: WordStyleOverrides;
  onCommit: (overrides: WordStyleOverrides) => void;
}

/** Word-level style-override screen. Panel `baseline` carries typography only — position would jump on per-key drop because the inherited offset is anchored to a different bounding box than the word's own override, so positionField gets its display baseline through a closure and both axes always persist. */
export function WordStyleOverridesPanel({
  sheet,
  segment,
  segmentOverrides,
  word,
  currentOverrides,
  onCommit,
}: WordStyleOverridesPanelProps) {
  const resolver = useWordStyleBaselineResolver();

  const segmentAlignment = useMemo(
    () => resolver.segmentEffectiveAlignment(sheet, segment.id, segmentOverrides),
    [resolver, sheet, segment.id, segmentOverrides],
  );

  const measuredPosition = useMemo(
    () => measureWordAnchorFraction(word.id, segmentAlignment),
    [word.id, segmentAlignment],
  );

  const positionBaseline = useMemo(
    () => resolver.positionBaseline(segmentAlignment, measuredPosition),
    [resolver, segmentAlignment, measuredPosition],
  );

  const panelBaseline = useMemo<Partial<WordStyleOverrides>>(
    () => resolver.typographyBaseline(sheet, segment.id, segmentOverrides),
    [resolver, sheet, segment.id, segmentOverrides],
  );

  const positionFieldWithBaseline = useCallback<StyleOverrideField<WordStyleOverrides>>(
    ({ current, commit }) => positionField({ current, baseline: positionBaseline, commit }),
    [positionBaseline],
  );

  const fields = useMemo<ReadonlyArray<StyleOverrideField<WordStyleOverrides>>>(
    () => [
      styleTogglesField,
      fontFamilyField,
      fontSizeField,
      fontWeightField,
      colorField,
      positionFieldWithBaseline,
      rotationField,
    ],
    [positionFieldWithBaseline],
  );

  return (
    <StyleOverridesPanel<WordStyleOverrides>
      title="Style overrides"
      current={currentOverrides}
      baseline={panelBaseline}
      fields={fields}
      onCommit={onCommit}
    />
  );
}
