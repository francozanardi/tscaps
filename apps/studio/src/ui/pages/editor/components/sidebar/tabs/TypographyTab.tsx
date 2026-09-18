import { memo } from 'react';
import { TypographySection } from '@ui/_shared/components/controls/sections/TypographySection';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useSheetScripts } from '@ui/_shared/hooks/useSheetScripts';
import { useCustomizedControlIds } from '@ui/pages/editor/hooks/useCustomizedControlIds';

interface TypographyTabProps {
  sheetScope: SheetScope;
}

export const TypographyTab = memo(function TypographyTab({ sheetScope }: TypographyTabProps) {
  const sheets = useSheets();
  const { horizontalSideResolver } = useRendering();
  const sheet = sheetScope.activeSheet;
  const customizedIds = useCustomizedControlIds(sheet);
  const scripts = useSheetScripts(sheet);
  return (
    <EditorTab
      title="Typography"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('typography')}
    >
      <TypographySection
        config={sheet.typographyConfig}
        onChange={(patch) => sheets.actions.style.updateTypography.execute(sheet.id, patch)}
        alignedTo={horizontalSideResolver.toPhysical(sheet.typographyConfig.textAlign, sheet.textDirection)}
        textDirection={sheet.textDirection}
        onTextDirectionChange={(value) => sheets.actions.sheets.updateTextDirection.execute(value)}
        hideTitle
        customizedIds={customizedIds}
        scripts={scripts}
      />
    </EditorTab>
  );
});
