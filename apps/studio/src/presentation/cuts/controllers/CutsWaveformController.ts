import type { WaveformExtractor } from '@core/cuts/domain/WaveformExtractor';

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
 * Observable waveform extraction for the Cuts mode. Runs the injected
 * {@link WaveformExtractor} once per source file and publishes the
 * resulting peak envelope through `'change'` events.
 *
 * Repeat calls for the same already-analysed `File` are no-ops. A
 * call for a different `File` while an extraction is in flight starts
 * a new extraction; the older one's result is discarded when it
 * resolves.
 */
export class CutsWaveformController extends EventTarget {

  private _state: CutsWaveformState = { kind: 'idle' };
  private _loadToken = 0;
  private _loadingFile: File | null = null;

  constructor(private readonly waveformExtractor: WaveformExtractor) {
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
      const peaks = await this.waveformExtractor.extract(file, PEAKS_PER_SECOND);
      if (token !== this._loadToken) return;
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

  private describeError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Failed to analyze the video audio.';
  }
}
