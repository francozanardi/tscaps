import { describe, expect, it } from 'vitest';
import type { PersonSighting } from '@core/subject-tracking/domain/PersonSighting';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SampledFrame, VideoFrameSampler } from '@core/subject-tracking/domain/VideoFrameSampler';
import { MediaPipePersonSightingReader } from '@core/subject-tracking/infrastructure/MediaPipePersonSightingReader';
import { PersonSightingWorkerClient } from '@core/subject-tracking/infrastructure/PersonSightingWorkerClient';
import { PersonSightingModelUrls } from '@core/subject-tracking/infrastructure/PersonSightingModelUrls';
import type {
  PersonSightingWorkerInbound,
  PersonSightingWorkerOutbound,
} from '@core/subject-tracking/infrastructure/workers/PersonSightingWorkerProtocol';

/**
 * Reading people from frames when the browser's GPU process restarts
 * partway, as Safari does under load: the decoder fails, or the models
 * lose their GPU context. The frames stand in for a video whose one
 * person's head is at `sourceSec / 10` across the picture.
 */

const SIX_SECONDS: SamplingStretch[] = [{ startSec: 0, endSec: 6, framesPerSecond: 1 }];

/** A bitmap that carries the moment it was taken at, so a stand-in worker can say who is in it. */
function bitmapAt(sourceSec: number): ImageBitmap {
  return { sourceSec, close: () => undefined } as unknown as ImageBitmap;
}

/** Frames at each stretch's rate; its first `failures` reads fail with Safari's decoder error after `framesBeforeFailing` frames. */
class FailingSampler implements VideoFrameSampler {
  reads = 0;

  constructor(private failures: number, private readonly framesBeforeFailing: number) {}

  async *sample(_video: Blob, stretches: ReadonlyArray<SamplingStretch>, signal: AbortSignal): AsyncGenerator<SampledFrame> {
    this.reads += 1;
    const failing = this.failures > 0;
    if (failing) this.failures -= 1;
    let given = 0;
    for (const stretch of stretches) {
      for (let sec = stretch.startSec; sec < stretch.endSec - 1e-9; sec += 1 / stretch.framesPerSecond) {
        signal.throwIfAborted();
        if (failing && given === this.framesBeforeFailing) throw new DOMException('Decoder failure', 'EncodingError');
        given += 1;
        yield { sourceSec: sec, bitmap: bitmapAt(sec) };
      }
    }
  }
}

/**
 * Stand-ins for the sighting worker, answering on the next turn: each
 * sees the person where they are, except that the worker numbered
 * `losesContextAt.worker` answers `lost` from its `losesContextAt.sight`th frame on.
 */
class StandInWorkers {
  readonly started: Array<{ terminated: boolean; onGpu?: boolean }> = [];

  constructor(private readonly losesContextAt: { worker: number; sight: number } | null = null) {}

  create = (): Worker => {
    const number = this.started.length;
    const state: { terminated: boolean; onGpu?: boolean } = { terminated: false };
    this.started.push(state);
    const listeners: Array<(event: MessageEvent<PersonSightingWorkerOutbound>) => void> = [];
    let sights = 0;
    const answer = (message: PersonSightingWorkerOutbound) => setTimeout(() => {
      if (!state.terminated) for (const listener of listeners) listener({ data: message } as MessageEvent<PersonSightingWorkerOutbound>);
    }, 0);
    return {
      addEventListener: (type: string, listener: (event: MessageEvent<PersonSightingWorkerOutbound>) => void) => {
        if (type === 'message') listeners.push(listener);
      },
      terminate: () => {
        state.terminated = true;
      },
      postMessage: (message: PersonSightingWorkerInbound) => {
        if (message.type === 'init') {
          state.onGpu = message.onGpu;
          return answer({ type: 'ack', requestId: message.requestId });
        }
        sights += 1;
        if (this.losesContextAt?.worker === number && sights >= this.losesContextAt.sight) return answer({ type: 'lost', requestId: message.requestId });
        const sec = (message.bitmap as unknown as { sourceSec: number }).sourceSec;
        const person: PersonSighting = { box: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, head: { x: sec / 10, y: 0.3 }, source: 'pose', headHeight: 0.1 };
        return answer({ type: 'sighted', requestId: message.requestId, people: [person] });
      },
    } as unknown as Worker;
  };
}

function readerWith(sampler: VideoFrameSampler, workers: StandInWorkers): MediaPipePersonSightingReader {
  return new MediaPipePersonSightingReader(sampler, new PersonSightingWorkerClient(workers.create, PersonSightingModelUrls.DEFAULT, true));
}

function headsOf(frames: ReadonlyArray<{ sourceSec: number; people: ReadonlyArray<{ head: { x: number } }> }>): string[] {
  return frames.map((frame) => `${frame.sourceSec}:${frame.people[0]?.head.x}`);
}

const EVERY_SECOND = ['0:0', '1:0.1', '2:0.2', '3:0.3', '4:0.4', '5:0.5'];

describe('MediaPipePersonSightingReader', () => {
  it('takes a read up again after the decoder fails partway, with a new worker, missing and repeating no frame', async () => {
    const sampler = new FailingSampler(1, 3);
    const workers = new StandInWorkers();

    const frames = await readerWith(sampler, workers).read(new Blob(), SIX_SECONDS, new AbortController().signal, () => undefined);

    expect(headsOf(frames)).toEqual(EVERY_SECOND);
    expect(workers.started.map((worker) => [worker.terminated, worker.onGpu])).toEqual([[true, true], [false, true]]);
  });

  it('answers nothing a worker sees after its models lost their GPU context, and reads the rest with a new one on the CPU', async () => {
    const workers = new StandInWorkers({ worker: 0, sight: 4 });

    const frames = await readerWith(new FailingSampler(0, 0), workers).read(new Blob(), SIX_SECONDS, new AbortController().signal, () => undefined);

    expect(headsOf(frames)).toEqual(EVERY_SECOND);
    expect(workers.started.map((worker) => worker.onGpu)).toEqual([true, false]);
  });

  it('fails where the read fails again', async () => {
    const reading = readerWith(new FailingSampler(2, 3), new StandInWorkers()).read(new Blob(), SIX_SECONDS, new AbortController().signal, () => undefined);

    await expect(reading).rejects.toMatchObject({ name: 'EncodingError' });
  });

  it('does not take up a read that was stopped', async () => {
    const sampler = new FailingSampler(0, 0);
    const stopped = new AbortController();
    stopped.abort(new DOMException('Stopped', 'AbortError'));

    await expect(readerWith(sampler, new StandInWorkers()).read(new Blob(), SIX_SECONDS, stopped.signal, () => undefined)).rejects.toMatchObject({ name: 'AbortError' });
    expect(sampler.reads).toBe(1);
  });
});
