import { memo } from 'react';
import { PositionSection } from '@ui/_shared/components/controls/sections/PositionSection';
import { RotationSection } from '@ui/_shared/components/controls/sections/RotationSection';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface PositionTabProps {
  sheetScope: SheetScope;
}

export const PositionTab = memo(function PositionTab({ sheetScope }: PositionTabProps) {
  const sheets = useSheets();
  return (
    <EditorTab
      title="Position"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('position')}
    >
      <PositionSection
        config={sheetScope.activeSheet.alignmentConfig}
        onChange={(patch) => sheets.actions.style.updateAlignment.execute(patch)}
        hideTitle
      />
      <RotationSection
        config={sheetScope.activeSheet.rotationConfig}
        onChange={(patch) => sheets.actions.style.updateRotation.execute(patch)}
      />
    </EditorTab>
  );
});
