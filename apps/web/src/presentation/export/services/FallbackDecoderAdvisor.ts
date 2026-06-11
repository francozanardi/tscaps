import type { BrowserEnvironment } from '@core/_shared/UserAgentInspector';

export interface FormatRecommendation {
  /** Container format users recognize (e.g. "MP4"). */
  readonly format: string;
  /** Video codec the format is paired with (e.g. "H.264"). */
  readonly codec: string;
}

export interface FallbackDecoderAdvice {
  /** Codec of the source rendered as a name a user can read. */
  readonly humanCodec: string;
  /**
   * A safe format the user can convert their source to so the export
   * runs through the fast path. Always present — converting to a widely
   * supported format is the most reliable recovery path.
   */
  readonly reEncodeTo: FormatRecommendation;
  /**
   * A browser on the user's current operating system that natively
   * decodes the codec, or null when no clearly better option exists on
   * the same OS. We never suggest switching operating systems because
   * that's rarely actionable.
   */
  readonly betterBrowser: string | null;
}

/**
 * Builds user-facing recovery suggestions when the fast video decoder
 * isn't available for the source codec. The advice has two independent
 * parts: a format the user can convert the source to, and (optionally)
 * a browser on the same OS that decodes the codec natively.
 */
export class FallbackDecoderAdvisor {

  private static readonly CODEC_NAMES: Record<string, string> = {
    avc: 'H.264 (AVC)',
    hevc: 'H.265 (HEVC)',
    vp8: 'VP8',
    vp9: 'VP9',
    av1: 'AV1',
  };

  adviseFor(codec: string, env: BrowserEnvironment): FallbackDecoderAdvice {
    return {
      humanCodec: this.humanCodec(codec),
      reEncodeTo: { format: 'MP4', codec: 'H.264' },
      betterBrowser: this.bestBrowserOnCurrentOs(codec, env),
    };
  }

  private humanCodec(codec: string): string {
    return FallbackDecoderAdvisor.CODEC_NAMES[codec] ?? codec.toUpperCase();
  }

  private bestBrowserOnCurrentOs(codec: string, env: BrowserEnvironment): string | null {
    if (codec === 'hevc') return this.bestForHevc(env);
    return this.bestForOtherCodecs(env);
  }

  private bestForHevc(env: BrowserEnvironment): string | null {
    switch (env.os) {
      case 'macos':
        return env.browser === 'safari' ? null : 'Safari';
      case 'ios':
        return env.browser === 'safari' ? null : 'Safari';
      case 'windows':
        return env.browser === 'edge' || env.browser === 'chrome' ? null : 'Edge or Chrome';
      case 'android':
        return env.browser === 'chrome' ? null : 'Chrome';
      // On Linux no major browser ships an HEVC decoder by default, so we
      // don't surface a same-OS suggestion.
      case 'linux':
      case 'unknown':
      default:
        return null;
    }
  }

  private bestForOtherCodecs(env: BrowserEnvironment): string | null {
    if (env.browser === 'chrome' || env.browser === 'edge') return null;
    switch (env.os) {
      case 'macos':
      case 'windows':
      case 'linux':
      case 'android':
        return 'Chrome';
      default:
        return null;
    }
  }
}
