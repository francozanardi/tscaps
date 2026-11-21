import { useMemo } from 'react';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SegmentSplitterContext } from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { FontFaceSlot } from '@core/fonts/domain/FontScript';
import { FieldsSection } from '@ui/_shared/components/controls/sections/FieldsSection';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

/** A change to one mode's layout, as the fields report it: a segment-splitter stage's field, or the line splitter's. */
export type ModeLayoutChange =
  | { kind: 'segment'; type: SegmentSplitterConfig['type']; patch: Partial<SegmentSplitterConfig> }
  | { kind: 'line'; patch: Partial<LineSplitterConfig> };

interface ModeLayoutFieldsProps {
  segmentSplitterConfigs: ReadonlyArray<SegmentSplitterConfig>;
  lineSplitterConfig: LineSplitterConfig;
  splitterContext: SegmentSplitterContext;
  scripts: ReadonlyArray<FontFaceSlot>;
  onChange: (change: ModeLayoutChange) => void;
}

/**
 * The Scenes and Lines fields of one layout: a sheet's body, or one of
 * its template's modes.
 *
 * Every editable segment-splitter field lands in a single "Scenes"
 * section: the stages are a pipeline detail, and the person sees one
 * set of knobs for how scenes are cut. Field ids are namespaced by
 * splitter type so two stages with a field of the same name stay apart,
 * and each change is reported against the stage it belongs to.
 */
export function ModeLayoutFields({ segmentSplitterConfigs, lineSplitterConfig, splitterContext, scripts, onChange }: ModeLayoutFieldsProps) {
  const { segmentSplitters, lineSplitters } = useEngine();

  // Through each descriptor's `toDisplay` / `fromDisplay`, so a splitter
  // whose bounds depend on the context shows them projected while its
  // raw config is what is stored.
  const { sceneFields, sceneValues, fieldRouting } = useMemo(() => {
    const fields: ControlField[] = [];
    const values: Record<string, ControlValue | undefined> = {};
    const routing: Record<string, { type: SegmentSplitterConfig['type']; fieldId: string }> = {};
    for (const config of segmentSplitterConfigs) {
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
  }, [segmentSplitterConfigs, segmentSplitters, splitterContext]);

  const lineDescriptor = lineSplitters.get(lineSplitterConfig.type);

  return (
    <>
      {sceneFields.length > 0 && (
        <FieldsSection
          scripts={scripts}
          title="Scenes"
          fields={sceneFields}
          values={sceneValues}
          onChange={(field, value) => {
            const route = fieldRouting[field.id]!;
            const patch = segmentSplitters.get(route.type).fromDisplay(route.fieldId, value, splitterContext);
            onChange({ kind: 'segment', type: route.type, patch });
          }}
        />
      )}
      {lineDescriptor.controlsSchema.length > 0 && (
        <FieldsSection
          scripts={scripts}
          title="Lines"
          fields={lineDescriptor.controlsSchema}
          values={lineSplitterConfig as unknown as Record<string, ControlValue>}
          onChange={(field, value) => onChange({ kind: 'line', patch: { [field.id]: value } as Partial<LineSplitterConfig> })}
        />
      )}
    </>
  );
}
