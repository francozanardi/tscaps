import type { DefaultVideoEncoderRefusal, VideoEncoderProbeObserver } from '@tscaps/engine';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

/**
 * Announces that this device's default video encoder refused the frame
 * a render probes it with, for exports and preview proxies alike, and
 * whether a software encoder took over.
 *
 * No notice is published: with the software encoder the render goes on,
 * and without it the render fails and reports that on its own.
 */
export class VideoEncoderProbeReporter implements VideoEncoderProbeObserver {

  constructor(private readonly telemetry: Telemetry) {}

  onDefaultEncoderRefused(refusal: DefaultVideoEncoderRefusal): void {
    const { selection } = refusal;
    this.telemetry.capture('video_encoder_fallback', {
      outcome: selection.softwareEncoderFailure === null ? 'software' : 'unavailable',
      codec: refusal.codec,
      width: refusal.width,
      height: refusal.height,
      default_encoder_failure: selection.defaultEncoderFailure,
      software_encoder_failure: selection.softwareEncoderFailure,
    });
  }
}
