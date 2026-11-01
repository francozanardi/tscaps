import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';

/**
 * Whether a source this browser refused may be offered the in-browser
 * conversion: the conversion reads HEVC, so an HEVC refusal is the only
 * one it can lift.
 */
export class VideoConversionAvailability {

  private static readonly CONVERTIBLE_CODEC = 'hevc';

  canConvert(refusal: unknown): refusal is UnsupportedVideoCodecError {
    return refusal instanceof UnsupportedVideoCodecError
      && refusal.codec === VideoConversionAvailability.CONVERTIBLE_CODEC;
  }
}
