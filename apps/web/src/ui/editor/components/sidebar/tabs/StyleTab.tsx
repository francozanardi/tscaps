import { memo, useMemo } from 'react';
import type { ControlField } from '@core/templates/domain/ControlField';
import { FieldsSection } from '@ui/editor/components/controls/FieldsSection';
import { EditorTab, type SheetScope } from '@ui/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface StyleTabProps {
  sheetScope: SheetScope;
}

interface StyleGroup {
  title: string;
  fields: ControlField[];
}

const UNGROUPED_TITLE = 'Style';

export const StyleTab = memo(function StyleTab({ sheetScope }: StyleTabProps) {
  const sheets = useSheets();
  const styleGroups = useMemo<StyleGroup[]>(() => {
    const order: string[] = [];
    const map = new Map<string, ControlField[]>();
    for (const field of sheetScope.activeSheet.template.styleControls) {
      const key = field.group ?? UNGROUPED_TITLE;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(field);
    }
    return order.map(key => ({ title: titleCase(key), fields: map.get(key)! }));
  }, [sheetScope.activeSheet.template]);

  const styleValuesMap = sheetScope.activeSheet.styleValues.values;
  // Single-group tabs hide the inner Section header — the EditorTab title is enough.
  const hideInnerTitles = styleGroups.length <= 1;

  return (
    <EditorTab
      title="Style"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('style')}
    >
      {styleGroups.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-faint">
          This template has no style controls.
        </p>
      ) : (
        styleGroups.map(group => (
          <FieldsSection
            key={group.title}
            title={hideInnerTitles ? undefined : group.title}
            fields={group.fields}
            values={styleValuesMap}
            onChange={(field, value) => sheets.actions.style.updateControl.execute(field, value)}
          />
        ))
      )}
    </EditorTab>
  );
});

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
