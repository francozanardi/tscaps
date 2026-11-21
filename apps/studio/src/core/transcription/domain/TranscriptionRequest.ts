import type { TranscriberOptions } from '@tscaps/engine';

/**
 * What one transcription call asks for, besides its audio and whoever
 * asked: `config`, whose shape the concrete transcriber owns (a model
 * and a device, say), and the `options` every transcriber reads.
 *
 * Handed in with every call: two calls can be in flight at once, and
 * neither may take the other's settings.
 */
export interface TranscriptionRequest {
  readonly config: unknown;
  readonly options?: TranscriberOptions;
}
