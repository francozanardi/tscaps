import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { SaveShotGraphicPresetAction } from '@core/shots/actions/SaveShotGraphicPresetAction';

/** How saving a graphic as a preset ended: the preset saved, or why nothing was. */
export type GraphicPresetSaveOutcome =
  | { readonly ok: true; readonly preset: { readonly id: string; readonly name: string } }
  | { readonly ok: false; readonly problem: string };

/**
 * Saves a graphic on the video as it stands as a preset of the person's
 * own, as the editor's *Save as a new preset* does: kept on this device,
 * listed first among the graphic presets, and the graphic counts as made
 * from it from then on. No undo takes it back.
 */
export class GraphicPresetSaver {
  constructor(
    private readonly parser: EditorRefParser,
    private readonly save: SaveShotGraphicPresetAction,
  ) {}

  /** `layerRef` is the graphic's layer as a ref (`layer:<id>`). */
  async saveAs(name: string, layerRef: string): Promise<GraphicPresetSaveOutcome> {
    const ref = this.parser.parse(layerRef);
    if (ref === null || ref.kind !== 'layer') return { ok: false, problem: `"${layerRef}" is not a layer ref; layer refs look like layer:<id>.` };
    try {
      const preset = await this.save.execute(ref.id, name);
      if (preset === null) return { ok: false, problem: `${layerRef} is not a graphic on the video.` };
      return { ok: true, preset: { id: preset.id, name: preset.name } };
    } catch (error) {
      return { ok: false, problem: `Not saved: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
