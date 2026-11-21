import type { AudioDecoder } from '@tscaps/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { AudioPeakFolder } from '@core/audio/infrastructure/AudioPeakFolder';
import type { WaveformMemory } from '@core/audio/domain/WaveformMemory';
import type { NonBlockingFailureReporter } from '@core/errors/services/NonBlockingFailureReporter';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';
import { QueueingTranscriber } from '@core/transcription/infrastructure/QueueingTranscriber';
import { WorkerTranscriber } from '@core/transcription/infrastructure/WorkerTranscriber';
import type {
  TranscriberWorkerInbound,
  TranscriberWorkerOutbound,
} from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';

/**
 * One model in one worker transcribes one video at a time. The promise
 * covered here: a call never gets another call's words, the worker
 * gets each call's own settings, and two videos started back to back
 * through the queue in front of it are both transcribed, each with its
 * own words.
 */

/** A worker whose answers the test sends by hand. */
class FakeTranscriberWorker extends EventTarget {
  readonly posted: TranscriberWorkerInbound[] = [];

  postMessage(message: TranscriberWorkerInbound): void {
    this.posted.push(message);
  }

  answer(data: TranscriberWorkerOutbound): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }
}

/** A decoder whose decodes the test finishes by hand, in the order they were asked for. */
class HeldAudioDecoder implements AudioDecoder {
  private readonly pending: ((pcm: Float32Array) => void)[] = [];

  get decodesAsked(): number {
    return this.pending.length;
  }

  decode(): Promise<Float32Array> {
    return new Promise((resolve) => this.pending.push(resolve));
  }

  finishDecode(decode: number): void {
    this.pending[decode]?.(new Float32Array(16));
  }
}

/** Lets queued work run until `condition` holds; fails when it never does. */
async function until(condition: () => boolean): Promise<void> {
  for (let tick = 0; tick < 200; tick++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('The awaited condition never held');
}

function wordsOf(result: TranscriptionResult): string[] {
  return result.document.getWords().map((word) => word.text);
}

function requester(): TranscriptionRequester {
  return { progress: new PreprocessingProgressStore(), projectId: null };
}

describe('WorkerTranscriber', () => {
  const substitute = <T>(stub: object): T => stub as T;
  const audio = new Blob(['audio']);
  let worker: FakeTranscriberWorker;
  let decoder: HeldAudioDecoder;
  let transcriber: WorkerTranscriber;

  beforeEach(() => {
    // The development build keeps the model's raw words on `window`.
    vi.stubGlobal('window', {});
    worker = new FakeTranscriberWorker();
    decoder = new HeldAudioDecoder();
    transcriber = new WorkerTranscriber(
      worker as unknown as Worker,
      decoder,
      16_000,
      substitute<NonBlockingFailureReporter>({ report: () => undefined }),
      substitute<Telemetry>({ capture: () => undefined }),
      substitute<AudioPeakFolder>({ ofPcm: () => new Float32Array(0) }),
      substitute<WaveformMemory>({ remember: () => undefined }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a call made while another is still decoding, and gives the first its own words', async () => {
    const first = transcriber.transcribe(audio, requester(), { config: { model: 'base' } });
    const second = transcriber.transcribe(audio, requester(), { config: { model: 'tiny' } });

    await expect(second).rejects.toThrow('A transcription is already in progress');
    decoder.finishDecode(0);
    await until(() => worker.posted.length === 1);
    worker.answer({ type: 'result', words: [{ text: 'first', start: 0, end: 1 }], untranscribedRegions: [] });

    expect(wordsOf(await first)).toEqual(['first']);
    expect(worker.posted).toHaveLength(1);
  });

  it('sends the worker the settings of the call it runs', async () => {
    const first = transcriber.transcribe(audio, requester(), { config: { model: 'base' }, options: { language: 'en' } });
    decoder.finishDecode(0);
    await until(() => worker.posted.length === 1);
    worker.answer({ type: 'result', words: [], untranscribedRegions: [] });
    await first;
    const second = transcriber.transcribe(audio, requester(), { config: { model: 'tiny' } });
    decoder.finishDecode(1);
    await until(() => worker.posted.length === 2);
    worker.answer({ type: 'result', words: [], untranscribedRegions: [] });
    await second;

    expect(worker.posted.map((message) => [message.transcriberConfig, message.options])).toEqual([
      [{ model: 'base' }, { language: 'en' }],
      [{ model: 'tiny' }, undefined],
    ]);
  });

  it('returns what the worker could not transcribe with the call that left it out', async () => {
    const call = transcriber.transcribe(audio, requester(), { config: null });
    decoder.finishDecode(0);
    await until(() => worker.posted.length === 1);
    worker.answer({
      type: 'result',
      words: [{ text: 'hello', start: 0, end: 1 }],
      untranscribedRegions: [{ start: 2, end: 3.5 }],
    });

    expect((await call).untranscribedRegions).toEqual([{ startSeconds: 2, endSeconds: 3.5 }]);
  });

  it('transcribes two videos started back to back, behind a queue, each with its own words', async () => {
    const queued = new QueueingTranscriber(transcriber);
    const firstRequester = requester();
    const secondRequester = requester();

    const first = queued.transcribe(audio, firstRequester, { config: { model: 'base' } });
    const second = queued.transcribe(audio, secondRequester, { config: { model: 'base' } });
    expect(secondRequester.progress.status.phase).toBe('queued');
    await until(() => decoder.decodesAsked === 1);
    decoder.finishDecode(0);
    await until(() => worker.posted.length === 1);
    worker.answer({ type: 'result', words: [{ text: 'first', start: 0, end: 1 }], untranscribedRegions: [] });
    await until(() => decoder.decodesAsked === 2);
    decoder.finishDecode(1);
    await until(() => worker.posted.length === 2);
    worker.answer({ type: 'result', words: [{ text: 'second', start: 0, end: 1 }], untranscribedRegions: [] });

    expect(wordsOf(await first)).toEqual(['first']);
    expect(wordsOf(await second)).toEqual(['second']);
  });
});
