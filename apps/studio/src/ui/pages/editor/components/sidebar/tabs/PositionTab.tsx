import { memo, useMemo } from 'react';
import type { AlignmentConfig } from '@tscaps/engine';
import { PositionSection } from '@ui/_shared/components/controls/sections/PositionSection';
import { RotationSection } from '@ui/_shared/components/controls/sections/RotationSection';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';

interface PositionTabProps {
  sheetScope: SheetScope;
}

export const PositionTab = memo(function PositionTab({ sheetScope }: PositionTabProps) {
  const sheets = useSheets();
  const { horizontalPlacementResolver } = useRendering();
  const sheet = sheetScope.activeSheet;
  const alignment = sheet.alignmentConfig;

  // A template may anchor its captions relative to reading order, but this
  // panel is a map of the frame: it shows where the box actually sits, and
  // every edit writes that back in screen terms.
  const horizontal = useMemo(
    () => horizontalPlacementResolver.resolve(
      alignment.horizontalAlign,
      alignment.horizontalOffset,
      sheet.textDirection,
    ),
    [horizontalPlacementResolver, alignment.horizontalAlign, alignment.horizontalOffset, sheet.textDirection],
  );
  const onScreenAlignment = useMemo<AlignmentConfig>(
    () => ({
      ...alignment,
      horizontalAlign: horizontal.side,
      horizontalOffset: horizontal.offsetFromLeft,
    }),
    [alignment, horizontal],
  );

  return (
    <EditorTab
      title="Position"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('position')}
    >
      <PositionSection
        config={onScreenAlignment}
        onChange={(patch) => sheets.actions.style.updateAlignment.execute(sheet.id, {
          horizontalAlign: horizontal.side,
          horizontalOffset: horizontal.offsetFromLeft,
          ...patch,
        })}
        hideTitle
        heldVerticalAlign={sheet.template.heldVerticalAlign()}
      />
      <RotationSection
        config={sheet.rotationConfig}
        onChange={(patch) => sheets.actions.style.updateRotation.execute(sheet.id, patch)}
      />
    </EditorTab>
  );
});
