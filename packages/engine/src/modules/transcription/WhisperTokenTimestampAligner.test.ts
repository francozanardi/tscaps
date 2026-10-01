import { describe, expect, it } from 'vitest';
import {
  WhisperTokenTimestampAligner,
  type TokenTimestampExtractingModel,
  type TokenTimestamps,
} from '@modules/transcription/WhisperTokenTimestampAligner';

/**
 * A model whose extraction behaves like the library's: `rowTimes[r]` is
 * where the DTW path enters row r, the rows before `inputIds` are left out
 * and read as zero, and the final token repeats the last row it has.
 */
function modelWithRows(rowTimes: number[]): TokenTimestampExtractingModel & { framesSeen: unknown[] } {
  const framesSeen: unknown[] = [];
  return {
    framesSeen,
    _extract_token_timestamps: (_outputs, _heads, numFrames, _precision, inputIds): TokenTimestamps => {
      framesSeen.push(numFrames);
      const length = rowTimes.length + 1;
      const data = new Float32Array(length);
      for (let index = inputIds; index < rowTimes.length; index++) data[index] = rowTimes[index]!;
      data[length - 1] = rowTimes[rowTimes.length - 1]!;
      return { dims: [1, length], data };
    },
  };
}

function extract(model: TokenTimestampExtractingModel, inputIds: number, numFrames: unknown = 3000): number[] {
  return [...model._extract_token_timestamps(null, null, numFrames, 0.02, inputIds).data];
}

describe('WhisperTokenTimestampAligner', () => {
  // Rows 0-2 are the prompt; row 2 predicts the first text token (index 3),
  // row 3 reads it. The DTW is pinned at the window start: row 2 enters at 0.
  const rows = [0, 0, 0, 1.0, 1.5, 2.0, 2.5];

  it('places each token midway between the row reading it and the row predicting it', () => {
    const model = modelWithRows(rows);
    new WhisperTokenTimestampAligner().install(model);

    const times = extract(model, 3);

    expect(times[4]).toBeCloseTo(1.25);
    expect(times[5]).toBeCloseTo(1.75);
  });

  it('keeps the reading time for a token whose predicting row is pinned to the window start', () => {
    const model = modelWithRows(rows);
    new WhisperTokenTimestampAligner().install(model);

    expect(extract(model, 3)[3]).toBeCloseTo(1.0);
  });

  it('gives the final token the time of the row that predicts it', () => {
    const model = modelWithRows(rows);
    new WhisperTokenTimestampAligner().install(model);

    const times = extract(model, 3);

    expect(times[times.length - 1]).toBeCloseTo(2.5);
    expect(times[times.length - 2]).toBeCloseTo(2.25);
  });

  it('hands the extraction encoder frames, half the mel frames it was given', () => {
    const model = modelWithRows(rows);
    new WhisperTokenTimestampAligner().install(model);

    extract(model, 3, 1729);

    expect(model.framesSeen).toEqual([864, 864]);
  });

  it('leaves a run without a prompt as the extraction returned it', () => {
    const model = modelWithRows(rows);
    new WhisperTokenTimestampAligner().install(model);

    expect(extract(model, 0)).toEqual([0, 0, 0, 1.0, 1.5, 2.0, 2.5, 2.5]);
  });

  it('installs once however many times it is asked to', () => {
    const model = modelWithRows(rows);
    const aligner = new WhisperTokenTimestampAligner();
    aligner.install(model);
    aligner.install(model);

    extract(model, 3);

    expect(model.framesSeen).toHaveLength(2);
  });
});
