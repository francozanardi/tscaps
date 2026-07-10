import { memo, useMemo } from 'react';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import { FieldsSection } from '@ui/_shared/components/controls/sections/FieldsSection';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { Select } from '@ui/_shared/components/controls/fields/Select';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

interface StyleTabProps {
  sheetScope: SheetScope;
}

interface StyleGroup {
  title: string;
  fields: ControlField[];
}

const UNGROUPED_TITLE = 'Style';
const VARIANT_SECTION_TITLE = 'Preset';
const VARIANT_FIELD_LABEL = 'Preset';

export const StyleTab = memo(function StyleTab({ sheetScope }: StyleTabProps) {
  const sheets = useSheets();
  const activeSheet = sheetScope.activeSheet;
  const styleGroups = useMemo<StyleGroup[]>(() => {
    const order: string[] = [];
    const map = new Map<string, ControlField[]>();
    for (const field of activeSheet.template.styleControls) {
      const key = field.group ?? UNGROUPED_TITLE;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(field);
    }
    return order.map(key => ({ title: titleCase(key), fields: map.get(key)! }));
  }, [activeSheet.template]);

  const variants = activeSheet.template.variants;
  const variantOptions = useMemo(
    () => variants.map((v, i) => ({ value: String(i), label: v.label })),
    [variants],
  );
  const showVariantPicker = variants.length >= 2;

  const styleValuesMap = activeSheet.styleValues.values;
  // Single-group tabs hide the inner Section header — the EditorTab title is enough.
  const hideInnerTitles = !showVariantPicker && styleGroups.length <= 1;

  return (
    <EditorTab
      title="Style"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('style')}
    >
      {showVariantPicker && (
        <Section title={VARIANT_SECTION_TITLE}>
          <Select
            label={VARIANT_FIELD_LABEL}
            value={String(activeSheet.variantIndex)}
            options={variantOptions}
            onChange={(value) => sheets.actions.style.updateVariant.execute(Number(value))}
          />
        </Section>
      )}
      {styleGroups.length === 0 ? (
        !showVariantPicker && (
          <p className="py-6 text-center text-sm text-fg-faint">
            This template has no style controls.
          </p>
        )
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
