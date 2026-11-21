import type { OutputFormat } from '@tscaps/engine';

/** The codec a soundtrack would be written with in each export format here; null where none can be. */
export interface SoundtrackCodecs {
  readonly mp4: string | null;
  readonly webm: string | null;
}

/**
 * What is worth telling the reader before an export about how its
 * soundtrack will be written.
 *
 * - `opus-in-mp4`: an MP4 file whose sound is Opus rather than the AAC
 *   people expect, which some players refuse.
 * - `not-encodable`: no codec can be written for this format, so the
 *   sounds will be left out; `otherFormat` is a format that keeps them,
 *   or null when none does.
 */
export type SoundtrackCodecAdvice =
  | { readonly kind: 'opus-in-mp4' }
  | { readonly kind: 'not-encodable'; readonly otherFormat: OutputFormat | null };

/**
 * Decides whether the codec a soundtrack will be written with deserves
 * a word in the export dialog. Silent when it is what a reader would
 * expect of the format: AAC in MP4, Opus in WebM.
 */
export class SoundtrackCodecAdvisor {

  adviseFor(format: OutputFormat, codecs: SoundtrackCodecs): SoundtrackCodecAdvice | null {
    const codec = codecs[format];
    if (codec === null) return { kind: 'not-encodable', otherFormat: this.otherFormatKeepingSound(format, codecs) };
    if (format === 'mp4' && codec === 'opus') return { kind: 'opus-in-mp4' };
    return null;
  }

  private otherFormatKeepingSound(format: OutputFormat, codecs: SoundtrackCodecs): OutputFormat | null {
    const other: OutputFormat = format === 'mp4' ? 'webm' : 'mp4';
    return codecs[other] === null ? null : other;
  }
}
