import { memo, useMemo, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SegmentSplitterContext } from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { FieldsSection } from '@ui/_shared/components/controls/sections/FieldsSection';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';

interface LayoutTabProps {
  sheetScope: SheetScope;
  document: Document | null;
  segmentOverrides: SegmentOverrides;
}

type PendingChange =
  | { kind: 'segment'; type: SegmentSplitterConfig['type']; patch: Partial<SegmentSplitterConfig> }
  | { kind: 'line'; patch: Partial<LineSplitterConfig> };

export const LayoutTab = memo(function LayoutTab({
  sheetScope,
  document,
  segmentOverrides,
}: LayoutTabProps) {
  const { segmentSplitters, lineSplitters } = useEngine();
  const sheets = useSheets();
  const editor = useEditor();
  const { activeSheet } = sheetScope;

  // Splitter controls go through each descriptor's `toDisplay`/`fromDisplay`
  // so context-aware splitters can present runtime-projected bounds and
  // values while still persisting their raw config.
  const splitterContext = useMemo<SegmentSplitterContext>(
    () => ({
      fontSize: activeSheet.typographyConfig.fontSize,
      referenceFontSize: activeSheet.template.typography.fontSize,
    }),
    [activeSheet.typographyConfig.fontSize, activeSheet.template.typography.fontSize],
  );

  // Flatten all editable segment-splitter controls into a single "Scenes"
  // section. Splitters are an engine-side pipeline detail; users only see
  // one knob set for how scenes are cut. Field ids are namespaced by
  // splitter type so collisions across stages (e.g. multiple `enabled`
  // toggles) stay isolated; `fieldRouting` remembers the original id and
  // owner so onChange can patch the right stage.
  const { sceneFields, sceneValues, fieldRouting } = useMemo(() => {
    const fields: ControlField[] = [];
    const values: Record<string, ControlValue | undefined> = {};
    const routing: Record<string, { type: SegmentSplitterConfig['type']; fieldId: string }> = {};
    for (const config of activeSheet.segmentSplitterConfigs) {
      const descriptor = segmentSplitters.get(config.type);
      if (descriptor.controlsSchema.length === 0) continue;
      const display = descriptor.toDisplay(config, splitterContext);
      for (const field of display.fields) {
        const namespacedId = `${descriptor.type}.${field.id}`;
        fields.push({ ...field, id: namespacedId });
        values[namespacedId] = display.values[field.id];
        routing[namespacedId] = { type: descriptor.type, fieldId: field.id };
      }
    }
    return { sceneFields: fields, sceneValues: values, fieldRouting: routing };
  }, [activeSheet.segmentSplitterConfigs, segmentSplitters, splitterContext]);

  const lineDescriptor = lineSplitters.get(activeSheet.lineSplitterConfig.type);

  // A splitter-field change reflows every scene in the sheet, dropping
  // any manual shape (frozen layout or style overrides). Surface a
  // confirm dialog only when there's something to lose.
  const activeSheetHasFrozen = useMemo(() => {
    if (!document) return false;
    for (const section of document.sections) {
      if (section.kind !== activeSheet.id) continue;
      for (const seg of section.segments) {
        if (segmentOverrides.isFrozen(seg.id)) return true;
      }
    }
    return false;
  }, [document, activeSheet.id, segmentOverrides]);

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const applyChange = (change: PendingChange): void => {
    if (change.kind === 'segment') sheets.actions.style.updateSegmentSplitter.execute(change.type, change.patch);
    else sheets.actions.style.updateLineSplitter.execute(change.patch);
  };

  const requestChange = (change: PendingChange): void => {
    if (activeSheetHasFrozen) {
      setPendingChange(change);
      return;
    }
    applyChange(change);
  };

  return (
    <EditorTab
      title="Layout"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('layout')}
    >
      {sceneFields.length > 0 && (
        <FieldsSection
          title="Scenes"
          fields={sceneFields}
          values={sceneValues}
          onChange={(field, value) => {
            const route = fieldRouting[field.id]!;
            const patch = segmentSplitters.get(route.type).fromDisplay(route.fieldId, value, splitterContext);
            requestChange({ kind: 'segment', type: route.type, patch });
          }}
        />
      )}
      {lineDescriptor.controlsSchema.length > 0 && (
        <FieldsSection
          title="Lines"
          fields={lineDescriptor.controlsSchema}
          values={activeSheet.lineSplitterConfig as unknown as Record<string, ControlValue>}
          onChange={(field, value) =>
            requestChange({ kind: 'line', patch: { [field.id]: value } as Partial<LineSplitterConfig> })
          }
        />
      )}
      <ConfirmDialog
        open={pendingChange !== null}
        message="Changing the layout will reflow every scene in this sheet. Manual line breaks, scene splits, and per-scene style overrides will be lost — text edits and timings are kept."
        confirmLabel="Apply"
        danger
        onConfirm={() => {
          if (!pendingChange) return;
          editor.actions.segments.resetSheetLayout.execute(activeSheet.id);
          applyChange(pendingChange);
          setPendingChange(null);
        }}
        onCancel={() => setPendingChange(null)}
      />
    </EditorTab>
  );
});
