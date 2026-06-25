import type { AudioDecoder } from '@tscaps/engine';

const DECODE_SAMPLE_RATE = 8000;
const PEAKS_PER_SECOND = 100;

export interface CutsWaveformData {
  readonly peaks: Float32Array;
  readonly peaksPerSecond: number;
}

export type CutsWaveformState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly source: File; readonly data: CutsWaveformData }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Observable waveform extraction for the Cuts mode. Decodes the
 * active video's audio once per source file via the injected
 * `AudioDecoder`, downsamples to per-second peak buckets, and
 * publishes the result through `'change'` events.
 *
 * Repeat calls for the same already-decoded `File` are no-ops. A call
 * for a different `File` while a decode is in flight starts a new
 * decode; the older one's result is discarded when it resolves.
 */
export class CutsWaveformController extends EventTarget {

  private _state: CutsWaveformState = { kind: 'idle' };
  private _loadToken = 0;
  private _loadingFile: File | null = null;

  constructor(private readonly audioDecoder: AudioDecoder) {
    super();
  }

  get state(): CutsWaveformState {
    return this._state;
  }

  async loadFor(file: File): Promise<void> {
    if (this._state.kind === 'ready' && this._state.source === file) return;
    if (this._loadingFile === file) return;
    const token = ++this._loadToken;
    this._loadingFile = file;
    this.setState({ kind: 'loading' });
    try {
      const samples = await this.audioDecoder.decode(file, DECODE_SAMPLE_RATE);
      if (token !== this._loadToken) return;
      const peaks = this.bucketPeaks(samples, DECODE_SAMPLE_RATE, PEAKS_PER_SECOND);
      this._loadingFile = null;
      this.setState({
        kind: 'ready',
        source: file,
        data: { peaks, peaksPerSecond: PEAKS_PER_SECOND },
      });
    } catch (err) {
      if (token !== this._loadToken) return;
      this._loadingFile = null;
      this.setState({ kind: 'error', message: this.describeError(err) });
    }
  }

  private setState(next: CutsWaveformState): void {
    this._state = next;
    this.dispatchEvent(new Event('change'));
  }

  private bucketPeaks(samples: Float32Array, sampleRate: number, peaksPerSecond: number): Float32Array {
    const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSecond));
    const peakCount = Math.floor(samples.length / samplesPerPeak);
    const peaks = new Float32Array(peakCount);
    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = start + samplesPerPeak;
      let peak = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(samples[j]!);
        if (abs > peak) peak = abs;
      }
      peaks[i] = peak;
    }
    return peaks;
  }

  private describeError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Failed to analyze the video audio.';
  }
}
