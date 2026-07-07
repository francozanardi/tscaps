interface CanvasWithCapture {
  captureStream: () => MediaStream;
}

/**
 * Owns a `MediaStream` cloned from the editor's main canvas for
 * the live preview mirror. Returns `null` when the host browser
 * does not implement `HTMLCanvasElement.captureStream`.
 *
 * Subscribers listen for `'change'` and read {@link getStream}.
 */
export class MainVideoStreamCaptureController extends EventTarget {

  private stream: MediaStream | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    super();
  }

  start(): void {
    this.refresh();
  }

  stop(): void {
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private refresh(): void {
    const candidate = this.canvas as unknown as Partial<CanvasWithCapture>;
    const next = typeof candidate.captureStream === 'function' ? candidate.captureStream() : null;
    if (next === this.stream) return;
    this.stream = next;
    this.dispatchEvent(new Event('change'));
  }
}
