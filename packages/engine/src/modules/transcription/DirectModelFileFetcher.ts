import type { ModelFileFetcher } from '@modules/transcription/ModelFileFetcher';
import { ModelFileRequestFailedError } from '@modules/transcription/ModelFileRequestFailedError';

/**
 * Requests each model file from the URL it was given.
 *
 * A rejected request is a transport failure by definition: `fetch`
 * resolves for every response the host produces, whatever its status,
 * and rejects only when no response arrived at all. That is the one
 * signal separating "the host cannot be reached from here" from every
 * other way loading a model can go wrong, so it is named rather than
 * left as the runtime's own generic rejection.
 */
export class DirectModelFileFetcher implements ModelFileFetcher {
  async fetch(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await globalThis.fetch(url, init);
    } catch (cause) {
      throw new ModelFileRequestFailedError(`Could not reach ${url}.`, { cause });
    }
  }
}
