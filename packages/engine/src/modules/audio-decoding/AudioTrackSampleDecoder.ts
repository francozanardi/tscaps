import type { AudioSample } from 'mediabunny';

/**
 * Decodes the primary audio track of a media file, an audio file or a
 * video, into samples on the source's own timeline, in order, one
 * stretch at a time, so a consumer that reads as it goes never holds
 * the whole track decoded.
 *
 * The samples tile the track: each starts where the previous one ends,
 * with no overlap. They carry every channel of the track. The caller
 * owns each sample it is handed and closes it.
 */
export interface AudioTrackSampleDecoder {
  /**
   * @param source - The media file whose primary audio track is decoded.
   * @param sampleRate - The rate of every sample yielded; the decoder
   * resamples to it.
   * @returns The samples, lazily; the iteration rejects when the track
   * cannot be read or decoded here. Ending the iteration early stops
   * the decoding.
   */
  samples(source: Blob, sampleRate: number): AsyncIterable<AudioSample>;
}
