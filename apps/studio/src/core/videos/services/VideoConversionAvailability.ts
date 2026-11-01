import { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';

/**
 * Whether a source this browser refused may be offered the in-browser
 * conversion: an HEVC source, where `conversionSupported` says this
 * browser runs it.
 *
 * Firefox does not: through the software HEVC decoder its tab grew to
 * 4–5 GB on Linux and the browser crashed on Windows, where other
 * browsers stayed under 1 GB. So Firefox keeps the refusal it has today
 * rather than a conversion that takes it down.
 */
export class VideoConversionAvailability {

  private static readonly CONVERTIBLE_CODEC = 'hevc';

  constructor(private readonly conversionSupported: boolean) {}

  canConvert(refusal: unknown): refusal is UnsupportedVideoCodecError {
    return this.conversionSupported
      && refusal instanceof UnsupportedVideoCodecError
      && refusal.codec === VideoConversionAvailability.CONVERTIBLE_CODEC;
  }
}
