import type { FailureReason } from '@core/errors/domain/FailureReason';
import type { FailureReasonRule } from '@core/errors/domain/FailureReasonRule';
import type { UnreadableVideoPositionReader } from '@core/errors/domain/UnreadableVideoPositionReader';

/**
 * Recognises a video that decoded fine up to some point and could not
 * be read past it. Most often the file is damaged there, though a
 * browser or device that fails partway looks the same.
 *
 * Listed ahead of the codec rule, which would otherwise claim the same
 * failure through the browser's `EncodingError` underneath it and
 * advise converting a format the browser has been reading all along.
 */
export class UnreadablePartwayFailureReasonRule implements FailureReasonRule {
  readonly reason: FailureReason = 'video-unreadable-partway';

  constructor(private readonly positionReader: UnreadableVideoPositionReader) {}

  matches(error: unknown): boolean {
    return this.positionReader.positionIn(error) !== null;
  }
}
