/** Token timestamps as the model returns them: `[batch, tokens]` seconds, flattened. */
export interface TokenTimestamps {
  readonly dims: number[];
  readonly data: Float32Array;
}

/**
 * The model's own token-timestamp extraction: the cross-attention rows of
 * every generated token, aligned to the audio frames by DTW. `inputIds` is
 * how many leading rows belong to the decoder prompt and are left out of
 * the alignment.
 */
export type TokenTimestampExtractor = (
  outputs: unknown,
  alignmentHeads: unknown,
  numFrames: unknown,
  timePrecision: number,
  inputIds: number,
) => TokenTimestamps;

/** The part of a loaded Whisper model this class reaches into. */
export interface TokenTimestampExtractingModel {
  _extract_token_timestamps: TokenTimestampExtractor;
}

/**
 * Corrects where a Whisper model places each token in time.
 *
 * A token's time comes from a DTW path through the decoder's
 * cross-attention, and there are two rows a token can be read from: the
 * one whose input *is* the token, and the one before it, which *predicts*
 * it. The extraction this wraps uses the first; the reference
 * implementation uses the second. Measured against audio whose timing is
 * known, the first lands about one token late (~0.2–0.3 s in English) and
 * the second about as early, so each token is placed at the midpoint of
 * the two.
 *
 * The DTW path is pinned to both corners of its window, so at each edge
 * one of the two readings is pinned too and says nothing:
 *
 * - a token whose predicting row sits on the window's first frame keeps
 *   the reading row's time — otherwise the first word of a window would
 *   start at its first instant, however long the silence before it;
 * - the final token, whose reading row covers the trailing silence up to
 *   the window's last frame, takes the predicting row's time — otherwise
 *   the last word would stretch to the end of the window.
 *
 * The frame count handed to the extraction is halved on the way in. It
 * arrives in mel frames, but the attention it crops runs over encoder
 * frames, half as many; left unhalved, a window shorter than the model's
 * full span keeps its zero padding in the alignment, and its last words
 * can be placed after the audio has ended.
 */
export class WhisperTokenTimestampAligner {

  private readonly installed = new WeakSet<TokenTimestampExtractingModel>();

  /**
   * Replaces the model's extraction with the corrected one, in place.
   * Installing twice on the same model is a no-op. The extraction runs
   * twice per window afterwards, once per row; both runs are small next to
   * the inference they follow.
   */
  install(model: TokenTimestampExtractingModel): void {
    if (this.installed.has(model)) return;
    this.installed.add(model);
    const original = model._extract_token_timestamps.bind(model);
    model._extract_token_timestamps = (outputs, alignmentHeads, numFrames, timePrecision, inputIds = 0) => {
      const encoderFrames = this.encoderFramesOf(numFrames);
      const reading = original(outputs, alignmentHeads, encoderFrames, timePrecision, inputIds);
      if (inputIds < 1) return reading;
      // One row earlier: index i of this run holds the row that reads token
      // i, so the row predicting token i sits at index i - 1.
      const predicting = original(outputs, alignmentHeads, encoderFrames, timePrecision, inputIds - 1);
      this.mergeInto(reading, predicting, inputIds);
      return reading;
    };
  }

  private encoderFramesOf(numFrames: unknown): unknown {
    return typeof numFrames === 'number' ? Math.floor(numFrames / 2) : numFrames;
  }

  private mergeInto(reading: TokenTimestamps, predicting: TokenTimestamps, inputIds: number): void {
    const [batchSize = 1, length = 0] = reading.dims;
    if (length < 2) return;
    for (let batch = 0; batch < batchSize; batch++) {
      const read = reading.data.subarray(batch * length, (batch + 1) * length);
      const pred = predicting.data.subarray(batch * length, (batch + 1) * length);
      for (let index = inputIds; index < length - 1; index++) {
        const predictingTime = pred[index - 1]!;
        if (predictingTime === 0) continue;
        read[index] = (read[index]! + predictingTime) / 2;
      }
      read[length - 1] = pred[length - 2]!;
    }
  }
}
