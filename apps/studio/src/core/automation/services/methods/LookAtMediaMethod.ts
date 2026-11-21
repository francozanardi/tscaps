import { z } from 'zod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { AutomationParamsReader } from '@core/automation/services/AutomationParamsReader';
import { MEDIA_LOOK_MAX_FILES, type MediaLooker } from '@core/media/services/MediaLooker';

const PARAMS = z.object({
  files: z.array(z.object({ media: z.string().min(1), times: z.array(z.number()).optional() })).min(1).max(MEDIA_LOOK_MAX_FILES),
});

/**
 * `look_at_media`: the person's files in the media bin as they are, in
 * one picture: pictures whole, GIFs and videos at moments of their own
 * timeline. Answers the picture (base64) and a line per file.
 */
export class LookAtMediaMethod implements AutomationMethod {
  readonly name = 'look_at_media';

  constructor(
    private readonly looker: MediaLooker,
    private readonly params: AutomationParamsReader,
  ) {}

  async run(params: unknown): Promise<unknown> {
    const { files } = this.params.read(this.name, PARAMS, params);
    const look = await this.looker.look(files.map((file) => ({ media: file.media, times: file.times })), new AbortController().signal);
    if (!look.ok) throw new AutomationCallFailedError(this.name, look.problem);
    return { summary: look.summary, pictures: [{ mediaType: look.sheet.mediaType, base64: look.sheet.base64 }] };
  }
}
