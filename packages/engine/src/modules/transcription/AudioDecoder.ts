/**
 * Decodes an audio/video Blob to mono PCM at the requested sample rate.
 * Implementations choose how to do this — using browser Web Audio APIs,
 * a pure-JS WAV parser, or trusting a pre-decoded byte stream — so the
 * decode strategy is decoupled from the consumer (e.g. WhisperTranscriber)
 * and from the platform (main thread vs Worker context).
 */
export interface AudioDecoder {
  decode(audio: Blob, targetSampleRate: number): Promise<Float32Array>;
}
