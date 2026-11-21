import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotGraphicTelemetryReporter } from '@core/shots/services/ShotGraphicTelemetryReporter';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';

/** A part of a graphic's document, as its Code tab edits it. */
export type GraphicDocumentPart = keyof GraphicDocument;

/**
 * Changes what a graphic layer shows: a preset picked in its place, a
 * value set on one of its fields, a part of its document rewritten, or
 * whether it keeps the captions off its shot.
 *
 * Each commits the previous state so it is one undo step; a run of
 * changes to one field or one part of the document — typing — is one
 * step. Does nothing for a layer that is gone, a layer that is not a
 * graphic, a field the graphic does not declare or a value of another
 * type than its default, or a change that changes nothing.
 */
export class SetShotGraphicAction {
  constructor(
    private readonly store: EditorStore,
    private readonly presets: ShotGraphicPresetApplier,
    private readonly telemetry: ShotGraphicTelemetryReporter,
  ) {}

  /**
   * Puts `preset` on the layer as it ships (`ShotGraphicPresetApplier`),
   * whatever the layer was before; given the preset it already is, it
   * starts it over the same way, as a reset does. One undo step.
   */
  applyPreset(layerId: string, preset: GraphicPreset): void {
    const layer = this.graphicLayer(layerId);
    if (layer === null) return;
    const { shots, audio } = this.store.snapshot();
    const applied = this.presets.applied(shots, audio, layer, preset);
    this.store.commit('Change graphic');
    this.store.patch({ shots: applied.shots, audio: applied.audio });
    // The preset it already is starts it over: a replay, not a choice.
    if (layer.graphic.presetId !== preset.id) this.telemetry.presetApplied(preset, layer.graphic);
  }

  setParam(layerId: string, fieldId: string, value: GraphicParamValue): void {
    const layer = this.graphicLayer(layerId);
    const field = layer?.graphic.fields.find((candidate) => candidate.id === fieldId);
    if (layer === null || field === undefined || typeof value !== typeof field.defaultValue) return;
    if ((layer.graphic.params[fieldId] ?? field.defaultValue) === value) return;
    this.replace(layer, { ...layer.graphic, params: { ...layer.graphic.params, [fieldId]: value } }, 'Change graphic', `graphicParam:${layerId}:${fieldId}`);
  }

  /** Keeps the captions off the graphic's shot, or lets them show again. One undo step. */
  setHidesCaptions(layerId: string, hidesCaptions: boolean): void {
    const layer = this.graphicLayer(layerId);
    if (layer === null || layer.graphic.hidesCaptions === hidesCaptions) return;
    this.replace(layer, { ...layer.graphic, hidesCaptions }, hidesCaptions ? 'Hide captions on shot' : 'Show captions on shot', `graphicHidesCaptions:${layerId}`);
  }

  setDocument(layerId: string, part: GraphicDocumentPart, text: string): void {
    const layer = this.graphicLayer(layerId);
    if (layer === null || layer.graphic.document[part] === text) return;
    const changed = this.replace(layer, { ...layer.graphic, document: { ...layer.graphic.document, [part]: text } }, 'Edit graphic code', `graphicDocument:${layerId}:${part}`);
    if (changed) this.telemetry.codeEdited(part);
  }

  /** Whether the layer took `graphic`. */
  private replace(layer: ShotGraphicLayer, graphic: Graphic, label: string, coalesceKey: string): boolean {
    const shots = this.store.snapshot().shots;
    const next = shots.withLayerReplaced({ id: layer.id, graphic });
    if (next === shots) return false;
    this.store.commit(label, coalesceKey);
    this.store.patch({ shots: next });
    return true;
  }

  private graphicLayer(layerId: string): ShotGraphicLayer | null {
    const layer = this.store.snapshot().shots.findLayer(layerId);
    return layer !== null && 'graphic' in layer ? layer : null;
  }
}
