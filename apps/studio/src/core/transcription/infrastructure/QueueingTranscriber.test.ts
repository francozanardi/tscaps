import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { describe, expect, it } from 'vitest';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { TranscriptionRequest } from '@core/transcription/domain/TranscriptionRequest';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';
import { QueueingTranscriber } from '@core/transcription/infrastructure/QueueingTranscriber';

/**
 * Behind it sits a transcriber that can do one call at a time. The
 * promise covered here: calls that overlap run one after the other, in
 * the order they came, each with its own request and its own result;
 * a call that has to wait says so; and a call that fails does not hold
 * up the next.
 */

/** A transcriber whose calls the test finishes by hand, which notes whether two ever ran at once. */
class HeldTranscriber implements ConfigurableTranscriber {
  readonly initialPhase: PreprocessingProgressPhase = 'audio-extract';
  readonly started: unknown[] = [];
  overlapped = false;
  private running = 0;
  private readonly outcomes: { resolve: (result: TranscriptionResult) => void; reject: (cause: Error) => void }[] = [];

  transcribe(_audio: Blob, _requester: TranscriptionRequester, request: TranscriptionRequest): Promise<TranscriptionResult> {
    if (this.running > 0) this.overlapped = true;
    this.running += 1;
    this.started.push(request.config);
    return new Promise<TranscriptionResult>((resolve, reject) => {
      this.outcomes.push({ resolve, reject });
    }).finally(() => {
      this.running -= 1;
    });
  }

  finish(call: number, text: string): void {
    this.outcomes[call]?.resolve({ document: documentSaying(text), untranscribedRegions: [] });
  }

  fail(call: number): void {
    this.outcomes[call]?.reject(new Error('transcriber exploded'));
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

function wordsOf(result: TranscriptionResult): string[] {
  return result.document.getWords().map((word) => word.text);
}

function requesterWith(progress: PreprocessingProgressStore): TranscriptionRequester {
  return { progress, projectId: null };
}

/** Lets queued work run until `condition` holds; fails when it never does. */
async function until(condition: () => boolean): Promise<void> {
  for (let tick = 0; tick < 200; tick++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('The awaited condition never held');
}

describe('QueueingTranscriber', () => {
  const audio = new Blob(['audio']);

  it('runs a call made while another is in flight once that one is over, each with its own request and result', async () => {
    const inner = new HeldTranscriber();
    const transcriber = new QueueingTranscriber(inner);

    const first = transcriber.transcribe(audio, requesterWith(new PreprocessingProgressStore()), { config: 'first' });
    const second = transcriber.transcribe(audio, requesterWith(new PreprocessingProgressStore()), { config: 'second' });
    await until(() => inner.started.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(inner.started).toEqual(['first']);

    inner.finish(0, 'first words');
    await until(() => inner.started.length === 2);
    inner.finish(1, 'second words');

    expect(wordsOf(await first)).toEqual(['first words']);
    expect(wordsOf(await second)).toEqual(['second words']);
    expect(inner.started).toEqual(['first', 'second']);
    expect(inner.overlapped).toBe(false);
  });

  it('runs the calls in the order they came', async () => {
    const inner = new HeldTranscriber();
    const transcriber = new QueueingTranscriber(inner);

    const calls = ['one', 'two', 'three'].map((config) =>
      transcriber.transcribe(audio, requesterWith(new PreprocessingProgressStore()), { config }));
    for (let call = 0; call < 3; call++) {
      await until(() => inner.started.length === call + 1);
      inner.finish(call, `words ${call}`);
    }
    await Promise.all(calls);

    expect(inner.started).toEqual(['one', 'two', 'three']);
  });

  it('shows a call that waits as queued, and starts it from the first phase when its turn comes', async () => {
    const inner = new HeldTranscriber();
    const transcriber = new QueueingTranscriber(inner);
    const firstProgress = new PreprocessingProgressStore();
    const secondProgress = new PreprocessingProgressStore();
    firstProgress.start(transcriber.initialPhase);
    secondProgress.start(transcriber.initialPhase);

    const first = transcriber.transcribe(audio, requesterWith(firstProgress), { config: 'first' });
    const second = transcriber.transcribe(audio, requesterWith(secondProgress), { config: 'second' });

    expect(firstProgress.status.phase).toBe('audio-extract');
    expect(secondProgress.status.phase).toBe('queued');
    await until(() => inner.started.length === 1);
    inner.finish(0, 'first words');
    await until(() => inner.started.length === 2);
    expect(secondProgress.status.phase).toBe('audio-extract');
    inner.finish(1, 'second words');
    await Promise.all([first, second]);
  });

  it('hands the turn to the next call when a call fails', async () => {
    const inner = new HeldTranscriber();
    const transcriber = new QueueingTranscriber(inner);

    const first = transcriber.transcribe(audio, requesterWith(new PreprocessingProgressStore()), { config: 'first' });
    const second = transcriber.transcribe(audio, requesterWith(new PreprocessingProgressStore()), { config: 'second' });
    await until(() => inner.started.length === 1);
    inner.fail(0);
    await expect(first).rejects.toThrow('transcriber exploded');
    await until(() => inner.started.length === 2);
    inner.finish(1, 'second words');

    expect(wordsOf(await second)).toEqual(['second words']);
  });
});
