import { describe, expect, it } from 'vitest';
import { VideoFrameDecodeFailedError } from '@tscaps/engine';
import { FailureReasonResolver } from '@core/errors/services/FailureReasonResolver';
import { CauseChainUnreadableVideoPositionReader } from '@core/errors/services/CauseChainUnreadableVideoPositionReader';
import { UnreadablePartwayFailureReasonRule } from '@core/errors/services/failure-reasons/UnreadablePartwayFailureReasonRule';
import { UnsupportedCodecFailureReasonRule } from '@core/errors/services/failure-reasons/UnsupportedCodecFailureReasonRule';

const resolver = new FailureReasonResolver([
  new UnreadablePartwayFailureReasonRule(new CauseChainUnreadableVideoPositionReader()),
  new UnsupportedCodecFailureReasonRule(),
]);

function decoderError(): DOMException {
  return new DOMException('Decoder error.', 'EncodingError');
}

function stoppedAt(seconds: number): VideoFrameDecodeFailedError {
  return new VideoFrameDecodeFailedError(seconds, { cause: decoderError() });
}

describe('a video that could not be read past some point', () => {
  it('is named as such rather than as a codec the browser lacks', () => {
    const failure = new Error('Export failed', { cause: stoppedAt(14.25) });

    expect(resolver.resolve(failure)).toBe('video-unreadable-partway');
  });

  it('is recognised inside one branch of an aggregate', () => {
    const failure = new AggregateError([new Error('encoder gone'), stoppedAt(3)], 'two strategies failed');

    expect(resolver.resolve(failure)).toBe('video-unreadable-partway');
  });

  it('is recognised by name when the class did not survive the trip', () => {
    const plain = Object.assign(new Error('Decoding stopped'), { name: 'VideoFrameDecodeFailedError', decodedUntilSec: 9.5 });

    expect(resolver.resolve(new Error('Export failed', { cause: plain }))).toBe('video-unreadable-partway');
  });

  it('is left to the codec rule when the very first frame could not be decoded', () => {
    expect(resolver.resolve(new Error('Export failed', { cause: stoppedAt(0) }))).toBe('codec-unsupported');
  });

  it('is not claimed for a decoder error that came without a position', () => {
    expect(resolver.resolve(new Error('Export failed', { cause: decoderError() }))).toBe('codec-unsupported');
  });
});
