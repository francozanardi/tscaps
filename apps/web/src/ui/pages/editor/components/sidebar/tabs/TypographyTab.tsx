import { memo } from 'react';
import { TypographySection } from '@ui/_shared/components/controls/sections/TypographySection';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface TypographyTabProps {
  sheetScope: SheetScope;
}

export const TypographyTab = memo(function TypographyTab({ sheetScope }: TypographyTabProps) {
  const sheets = useSheets();
  return (
    <EditorTab
      title="Typography"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('typography')}
    >
      <TypographySection
        config={sheetScope.activeSheet.typographyConfig}
        onChange={(patch) => sheets.actions.style.updateTypography.execute(patch)}
        hideTitle
      />
    </EditorTab>
  );
});
