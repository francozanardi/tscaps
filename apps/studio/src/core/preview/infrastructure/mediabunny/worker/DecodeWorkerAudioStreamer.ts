import { AudioSampleSink, type AudioSample, type InputAudioTrack } from 'mediabunny';
import { DecodedAudioChunkBuilder } from '@core/preview/infrastructure/mediabunny/worker/DecodedAudioChunkBuilder';
import type { DecodeWorkerResponder } from '@core/preview/infrastructure/mediabunny/worker/DecodeWorkerResponder';

// How much sound one message carries. Long enough that a thread too busy to take a message more than a
// few times a second still receives sound faster than it plays; short enough that the first one of a
// stream leaves within a few packets.
const CHUNK_SEC = 0.2;
// How many chunks may be on their way before the client has taken the first: the next ones are decoded
// while the client is still busy with it.
const CHUNKS_AHEAD = 2;

interface AudioStreamState {
  readonly streamId: number;
  readonly abortController: AbortController;
  pendingCredits: number;
  wakeUpCreditWait: () => void;
  sampleIterator: AsyncGenerator<AudioSample, void, unknown> | null;
}

/**
 * Decodes the opened source's sound inside the decode worker and posts
 * it to the client a chunk at a time, in presentation order from the
 * time asked.
 *
 * Flow control is by credit, as for pictures: a stream starts with a
 * few credits, each chunk posted spends one, and the client gives one
 * back per chunk it has taken. One stream runs at a time; starting
 * another ends the one running, and runs are serialised so two decode
 * loops never read the track at once. A stream that ends, for any
 * reason, always says so (`audio-end`, or `audio-error`): its consumer
 * would otherwise wait on it forever.
 */
export class DecodeWorkerAudioStreamer {
  private sink: AudioSampleSink | null = null;
  private activeStream: AudioStreamState | null = null;
  private lastRun: Promise<void> = Promise.resolve();

  constructor(private readonly responder: DecodeWorkerResponder) {}

  /**
   * Takes the sound of a newly opened source: `track` is its audio
   * track, or null where it has none. Resolves to whether there is
   * sound this browser can decode; where there is none, a stream ends
   * as soon as it starts.
   */
  async open(track: InputAudioTrack | null): Promise<boolean> {
    this.close();
    if (track === null || !(await this.canDecode(track))) return false;
    this.sink = new AudioSampleSink(track);
    return true;
  }

  /** Ends the stream running and lets go of the source's sound. */
  close(): void {
    this.abortActiveStream();
    this.sink = null;
  }

  start(streamId: number, startSourceSec: number): void {
    this.abortActiveStream();
    const sink = this.sink;
    if (sink === null) {
      this.responder.respond({ type: 'audio-end', streamId });
      return;
    }
    const state: AudioStreamState = {
      streamId,
      abortController: new AbortController(),
      pendingCredits: CHUNKS_AHEAD,
      wakeUpCreditWait: () => {},
      sampleIterator: null,
    };
    this.activeStream = state;
    this.lastRun = this.runWhenPreviousDrained(this.lastRun, sink, state, startSourceSec);
  }

  credit(streamId: number): void {
    const state = this.activeStream;
    if (!state || state.streamId !== streamId) return;
    state.pendingCredits++;
    const wake = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wake();
  }

  stop(streamId: number): void {
    if (this.activeStream?.streamId !== streamId) return;
    this.abortActiveStream();
  }

  private async canDecode(track: InputAudioTrack): Promise<boolean> {
    try {
      return await track.canDecode();
    } catch {
      // A track whose codec cannot even be asked about plays as no sound, like one that answers no.
      return false;
    }
  }

  private async runWhenPreviousDrained(
    previousRun: Promise<void>,
    sink: AudioSampleSink,
    state: AudioStreamState,
    startSourceSec: number,
  ): Promise<void> {
    await previousRun;
    if (state.abortController.signal.aborted) return;
    try {
      await this.postChunks(sink, state, startSourceSec);
      if (!state.abortController.signal.aborted) this.responder.respond({ type: 'audio-end', streamId: state.streamId });
    } catch (err) {
      if (!state.abortController.signal.aborted) {
        this.responder.respond({ type: 'audio-error', streamId: state.streamId, message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      this.finishIterator(state);
      if (this.activeStream === state) this.activeStream = null;
    }
  }

  private async postChunks(sink: AudioSampleSink, state: AudioStreamState, startSourceSec: number): Promise<void> {
    const iterator = sink.samples(startSourceSec);
    state.sampleIterator = iterator;
    const chunk = new DecodedAudioChunkBuilder();
    while (true) {
      const next = await iterator.next();
      if (state.abortController.signal.aborted) {
        if (!next.done) next.value.close();
        return;
      }
      if (next.done) break;
      const sample = next.value;
      try {
        if (chunk.breaksWith(sample)) await this.postChunk(state, chunk);
        chunk.add(sample);
      } finally {
        sample.close();
      }
      if (chunk.durationSec() >= CHUNK_SEC) await this.postChunk(state, chunk);
      if (state.abortController.signal.aborted) return;
    }
    if (!chunk.isEmpty()) await this.postChunk(state, chunk);
  }

  /** Posts what `chunk` holds once the client has room for it; nothing where the stream ended meanwhile. */
  private async postChunk(state: AudioStreamState, chunk: DecodedAudioChunkBuilder): Promise<void> {
    const payload = chunk.take();
    await this.awaitCredit(state);
    if (state.abortController.signal.aborted) return;
    this.responder.respond(
      { type: 'audio-chunk', streamId: state.streamId, chunk: payload },
      payload.channels.map((channel) => channel.buffer),
    );
  }

  private awaitCredit(state: AudioStreamState): Promise<void> {
    if (state.pendingCredits > 0) {
      state.pendingCredits--;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      state.wakeUpCreditWait = () => {
        state.pendingCredits--;
        resolve();
      };
    });
  }

  private abortActiveStream(): void {
    const state = this.activeStream;
    if (!state) return;
    state.abortController.abort();
    this.finishIterator(state);
    const wake = state.wakeUpCreditWait;
    state.wakeUpCreditWait = () => {};
    wake();
    this.activeStream = null;
    this.responder.respond({ type: 'audio-end', streamId: state.streamId });
  }

  private finishIterator(state: AudioStreamState): void {
    const iterator = state.sampleIterator;
    state.sampleIterator = null;
    if (!iterator) return;
    void iterator.return().catch(() => { /* already terminated */ });
  }
}
