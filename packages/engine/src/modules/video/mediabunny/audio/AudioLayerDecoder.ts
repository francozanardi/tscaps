/**
 * Decodes the audio of a layer's source whole, at a chosen sample rate,
 * keeping its channels.
 *
 * Rejects when the source carries no audio this decoder can read; the
 * reason is the implementation's to name.
 */
export interface AudioLayerDecoder {
  /**
   * @param source - An audio file, or a video file whose primary audio
   * track is decoded.
   * @param sampleRate - The rate of the returned buffer, which the
   * decoder resamples to.
   * @returns The audio from the source's time 0; anything the source
   * places before 0 is left out.
   */
  decode(source: Blob, sampleRate: number): Promise<AudioBuffer>;
}
