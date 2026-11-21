import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { GraphicPresetSaver } from '@core/editor-operations/services/GraphicPresetSaver';

const PARAMS = z.object({ layer: z.string().min(1), name: z.string().trim().min(1) });

/**
 * `save_graphic_preset`: saves a graphic on the video as a preset of the
 * person's own, kept in this browser and listed first among the graphic
 * presets. Answers the preset.
 */
export class SaveGraphicPresetMethod implements AutomationMethod {
  readonly name = 'save_graphic_preset';

  constructor(
    private readonly saver: GraphicPresetSaver,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { layer, name } = this.params.read(this.name, PARAMS, params);
    const saved = await this.saver.saveAs(name, layer);
    if (!saved.ok) throw new AutomationCallFailedError(this.name, saved.problem);
    return { preset: saved.preset.id, name: saved.preset.name };
  }
}
