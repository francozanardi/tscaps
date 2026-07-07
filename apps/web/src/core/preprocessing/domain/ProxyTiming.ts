/**
 * Selects how preview-proxy generation interleaves with the
 * transcribe step inside the preprocessing pipeline.
 *
 * - `parallel-with-transcribe`: proxy encoding starts at the same
 *   time as transcription. Used when transcription is server-side
 *   and the browser is free to encode.
 * - `sequential-after-transcribe`: proxy encoding waits until
 *   transcription finishes. Used when transcription runs a heavy
 *   browser-side worker that would compete with the encoder for
 *   the CPU.
 */
export type ProxyTiming = 'parallel-with-transcribe' | 'sequential-after-transcribe';
