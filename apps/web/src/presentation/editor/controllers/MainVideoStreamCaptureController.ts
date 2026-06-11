interface VideoElementWithCapture {
  captureStream: () => MediaStream;
}

/**
 * Owns a `MediaStream` cloned from the editor's main `<video>` for the
 * live preview mirror. Returns `null` when the host browser does not
 * implement `HTMLVideoElement.captureStream`.
 *
 * Browsers stop delivering frames on the cloned stream once the source
 * video ends and do not resume on replay. This controller re-captures
 * on the next `'play'` after every `'ended'` so the mirror keeps
 * updating instead of freezing on the final frame.
 *
 * Subscribers listen for `'change'` and read `getStream()`.
 */
export class MainVideoStreamCaptureController extends EventTarget {
  private stream: MediaStream | null = null;
  private endedSinceRefresh = false;

  constructor(private readonly el: HTMLVideoElement) {
    super();
  }

  start(): void {
    this.refresh();
    this.el.addEventListener('ended', this.markEnded);
    this.el.addEventListener('play', this.refreshIfEnded);
  }

  stop(): void {
    this.el.removeEventListener('ended', this.markEnded);
    this.el.removeEventListener('play', this.refreshIfEnded);
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private refresh(): void {
    const candidate = this.el as unknown as Partial<VideoElementWithCapture>;
    const next = typeof candidate.captureStream === 'function' ? candidate.captureStream() : null;
    if (next === this.stream) return;
    this.stream = next;
    this.dispatchEvent(new Event('change'));
  }

  private readonly markEnded = (): void => {
    this.endedSinceRefresh = true;
  };

  private readonly refreshIfEnded = (): void => {
    if (!this.endedSinceRefresh) return;
    this.endedSinceRefresh = false;
    this.refresh();
  };
}
