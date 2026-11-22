import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { TranscribeAction } from '@core/transcription/actions/TranscribeAction';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { TranscriptionRequest } from '@core/transcription/domain/TranscriptionRequest';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';
import { UNTRANSCRIBED_PLACEHOLDER_TEXT } from '@core/transcription/domain/UntranscribedPlaceholder';
import { WordOverlapClamper } from '@core/transcription/services/WordOverlapClamper';

/**
 * Two transcriptions can be in flight at once. The promise covered
 * here: each call asks the transcriber for the model and device of its
 * own preference, and what a call left untranscribed comes back with
 * that call's document, marked in it.
 */

class RecordingTranscriber implements ConfigurableTranscriber {
  readonly initialPhase: PreprocessingProgressPhase = 'audio-extract';
  readonly requests: TranscriptionRequest[] = [];

  constructor(private readonly results: readonly TranscriptionResult[]) {}

  async transcribe(_audio: Blob, _requester: TranscriptionRequester, request: TranscriptionRequest): Promise<TranscriptionResult> {
    this.requests.push(request);
    const result = this.results[this.requests.length - 1];
    if (!result) throw new Error('No result left for this call');
    return result;
  }
}

function documentSaying(text: string): Document {
  return new Document({
    sections: [new Section({
      segments: [new Segment({ lines: [new Line({ words: [new Word({ text, time: new TimeFragment(0, 1) })] })] })],
      kind: '',
    })],
  });
}

function requester(): TranscriptionRequester {
  return { progress: new PreprocessingProgressStore(), projectId: null };
}

describe('TranscribeAction', () => {
  const substitute = <T>(stub: object): T => stub as T;
  const telemetry = substitute<Telemetry>({ capture: () => undefined });
  const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

  it("asks the transcriber, with each call, for the model and device of that call's preference", async () => {
    const transcriber = new RecordingTranscriber([
      { document: documentSaying('first'), untranscribedRegions: [] },
      { document: documentSaying('second'), untranscribedRegions: [] },
    ]);
    const action = new TranscribeAction(transcriber, new WordOverlapClamper(), telemetry);

    await Promise.all([
      action.execute(video, { model: 'base', backend: 'wasm' }, requester()),
      action.execute(video, { model: 'tiny', backend: 'webgpu' }, requester()),
    ]);

    expect(transcriber.requests.map((request) => request.config)).toEqual([
      { model: 'base', device: 'wasm' },
      { model: 'tiny', device: 'webgpu' },
    ]);
  });

  it("marks what a call left untranscribed in that call's document, and returns it with it", async () => {
    const transcriber = new RecordingTranscriber([
      { document: documentSaying('hello'), untranscribedRegions: [{ startSeconds: 2, endSeconds: 3 }] },
    ]);
    const action = new TranscribeAction(transcriber, new WordOverlapClamper(), telemetry);

    const result = await action.execute(video, { model: 'base', backend: 'wasm' }, requester());

    expect(result.document.getWords().map((word) => word.text)).toEqual(['hello', UNTRANSCRIBED_PLACEHOLDER_TEXT]);
    expect(result.untranscribedRegions).toEqual([{ startSeconds: 2, endSeconds: 3 }]);
  });

  it('clips separate-audio words and untranscribed regions to the video end', async () => {
    const document = new Document({ sections: [new Section({
      segments: [new Segment({ lines: [new Line({ words: [
        new Word({ text: 'inside', time: new TimeFragment(1, 2) }),
        new Word({ text: 'crossing', time: new TimeFragment(4.5, 5.4) }),
        new Word({ text: 'outside', time: new TimeFragment(5, 6) }),
      ] })] })], kind: '',
    })] });
    const transcriber = new RecordingTranscriber([{
      document, untranscribedRegions: [
        { startSeconds: 2.5, endSeconds: 3 },
        { startSeconds: 4.7, endSeconds: 5.5 },
        { startSeconds: 5, endSeconds: 6 },
      ],
    }]);
    const action = new TranscribeAction(transcriber, new WordOverlapClamper(), telemetry);

    const result = await action.execute(video, { model: 'tiny', backend: 'wasm' }, requester(), {}, null, 5);

    expect(result.document.getWords().map((word) => [word.text, word.time.start, word.time.end])).toEqual([
      ['inside', 1, 2],
      [UNTRANSCRIBED_PLACEHOLDER_TEXT, 2.5, 3],
      ['crossing', 4.5, 4.7],
      [UNTRANSCRIBED_PLACEHOLDER_TEXT, 4.7, 5],
    ]);
    expect(result.untranscribedRegions).toEqual([
      { startSeconds: 2.5, endSeconds: 3 },
      { startSeconds: 4.7, endSeconds: 5 },
    ]);
  });
});
