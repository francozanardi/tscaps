import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { RemoteFileReader } from '@core/automation/domain/RemoteFileReader';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import type { ImportMediaAssetAction } from '@core/media/actions/ImportMediaAssetAction';

const PARAMS = z.object({ url: z.string().min(1), fileName: z.string().min(1), mimeType: z.string().default('') });

/**
 * `add_media`: adds a file the program serves (a video, a picture, a GIF,
 * a sound) to the open project's media bin, as adding it in the bin
 * does, with the bin's own refusals (kind, length, size). Answers the id
 * the bin gave it, which operations name it by (`place_media`,
 * `add_sounds`), and what it is.
 */
export class AddMediaMethod implements AutomationMethod {
  readonly name = 'add_media';

  constructor(
    private readonly files: RemoteFileReader,
    private readonly importMedia: ImportMediaAssetAction,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { url, fileName, mimeType } = this.params.read(this.name, PARAMS, params);
    const file = await this.files.read(url, fileName, mimeType);
    try {
      const asset = await this.importMedia.execute(file, 'project', 'automation');
      return {
        media: asset.id,
        type: asset.type,
        fileName: asset.fileName,
        ...(asset.durationSec === null ? {} : { durationSec: asset.durationSec }),
        ...(asset.widthPx === null || asset.heightPx === null ? {} : { width: asset.widthPx, height: asset.heightPx }),
      };
    } catch (cause) {
      throw new AutomationCallFailedError(this.name, `the bin refused ${fileName}`, { cause });
    }
  }
}
