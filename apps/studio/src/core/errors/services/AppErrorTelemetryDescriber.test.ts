import { describe, expect, it } from 'vitest';
import { AppError } from '@core/errors/domain/AppError';
import { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import { CauseChainUnreadableVideoPositionReader } from '@core/errors/services/CauseChainUnreadableVideoPositionReader';
import { VideoFrameDecodeFailedError } from '@tscaps/engine';

class AudioExtractionFailedError extends AppError {
  readonly name = 'AudioExtractionFailedError';

  constructor(options?: { cause: unknown }) {
    super('Audio extraction failed', options);
  }
}

const describer = new AppErrorTelemetryDescriber(new CauseChainUnreadableVideoPositionReader());

describe('AppErrorTelemetryDescriber', () => {
  it('reports the outer error and its immediate cause as their own fields', () => {
    const described = describer.describe(
      new AudioExtractionFailedError({ cause: new DOMException('no decoder for aac', 'NotSupportedError') }),
    );

    expect(described.error_name).toBe('AudioExtractionFailedError');
    expect(described.error_cause_name).toBe('NotSupportedError');
    expect(described.error_cause_message).toBe('no decoder for aac');
  });

  it('joins a chain of causes into one field', () => {
    const described = describer.describe(new AudioExtractionFailedError({
      cause: new Error('the container could not be read', {
        cause: new DOMException('no decoder for aac', 'NotSupportedError'),
      }),
    }));

    expect(described.error_chain).toBe(
      'AudioExtractionFailedError: Audio extraction failed'
      + ' -> Error: the container could not be read'
      + ' -> NotSupportedError: no decoder for aac',
    );
  });

  /**
   * A step that tried several strategies has no single reason. Losing
   * all but one of them is what makes a failure undiagnosable: the
   * surviving reason belongs to an attempt that was never going to
   * work on that runtime, and reads as the whole story.
   */
  it('renders every attempt of a step that tried several', () => {
    const described = describer.describe(new AudioExtractionFailedError({
      cause: new AggregateError(
        [new Error('the codec has no decoder'), new Error('the file did not fit in memory')],
        'No audio decode path succeeded',
      ),
    }));

    expect(described.error_chain).toBe(
      'AudioExtractionFailedError: Audio extraction failed'
      + ' -> AggregateError: No audio decode path succeeded'
      + ' [Error: the codec has no decoder | Error: the file did not fit in memory]',
    );
  });

  it('stops at a cause that points back into the chain', () => {
    const cycle = new Error('the first');
    cycle.cause = new Error('the second', { cause: cycle });

    const described = describer.describe(new AudioExtractionFailedError({ cause: cycle }));

    expect(described.error_chain).toBe(
      'AudioExtractionFailedError: Audio extraction failed'
      + ' -> Error: the first'
      + ' -> Error: the second',
    );
  });

  it('truncates a message long enough to blow a telemetry field', () => {
    const described = describer.describe(new AudioExtractionFailedError({ cause: new Error('x'.repeat(600)) }));

    expect(described.error_cause_message).toHaveLength(600);
    expect(described.error_chain).toContain('x'.repeat(500) + '...');
  });

  it('reports the second a video stopped decoding at, when that is the failure', () => {
    const decodeFailure = new VideoFrameDecodeFailedError(14.25, { cause: new DOMException('Decoder error.', 'EncodingError') });
    const described = describer.describe(new AudioExtractionFailedError({ cause: decodeFailure }));

    expect(described.video_unreadable_from_s).toBe(14.25);
  });

  it('reports no position for a failure that is not a decode stopping partway', () => {
    const described = describer.describe(
      new AudioExtractionFailedError({ cause: new DOMException('Decoder error.', 'EncodingError') }),
    );

    expect(described.video_unreadable_from_s).toBeNull();
  });
});
