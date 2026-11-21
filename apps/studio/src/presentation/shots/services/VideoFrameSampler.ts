/**
 * Pulls still frames out of video files at arbitrary timestamps.
 *
 * One detached `<video>` serves every request, and requests are run one
 * at a time: a seek in flight is what the next one would interrupt, and
 * the element reports a single `seeked` for whichever landed last. A
 * request for another file loads that file into the element first.
 * Frames already taken are answered from memory, so asking again is
 * free, for as long as the file itself is held.
 *
 * Call {@link dispose} when done — the element and its object URL are
 * held until then.
 */
export class VideoFrameSampler {
  private frames = new WeakMap<Blob, Map<string, string>>();
  private queue: Promise<unknown> = Promise.resolve();
  private video: HTMLVideoElement | null = null;
  private loadedSource: Blob | null = null;
  private objectUrl: string | null = null;
  private disposed = false;

  constructor(
    private readonly maxWidth: number = 200,
    private readonly quality: number = 0.6,
  ) {}

  /** A JPEG data URL of `source`'s frame at `seconds`. Rejects once disposed, or when the video cannot be decoded. */
  frameAt(source: Blob, seconds: number): Promise<string> {
    const key = seconds.toFixed(2);
    const known = this.frames.get(source)?.get(key);
    if (known) return Promise.resolve(known);
    const next = this.queue.then(() => this.take(source, seconds, key));
    // The chain must survive a rejected link, or one unreadable frame
    // would fail every request queued behind it.
    this.queue = next.catch(() => undefined);
    return next;
  }

  dispose(): void {
    this.disposed = true;
    this.frames = new WeakMap();
    this.unloadSource();
  }

  private async take(source: Blob, seconds: number, key: string): Promise<string> {
    if (this.disposed) throw new Error('VideoFrameSampler was disposed');
    const video = await this.ready(source);
    await this.seek(video, seconds);
    if (this.disposed) throw new Error('VideoFrameSampler was disposed');
    const frame = this.draw(video);
    this.framesOf(source).set(key, frame);
    return frame;
  }

  private framesOf(source: Blob): Map<string, string> {
    let frames = this.frames.get(source);
    if (!frames) {
      frames = new Map();
      this.frames.set(source, frames);
    }
    return frames;
  }

  private ready(source: Blob): Promise<HTMLVideoElement> {
    if (this.video && this.loadedSource === source) return Promise.resolve(this.video);
    this.unloadSource();
    const video = document.createElement('video');
    this.objectUrl = URL.createObjectURL(source);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = this.objectUrl;
    return new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', () => {
        this.video = video;
        this.loadedSource = source;
        resolve(video);
      }, { once: true });
      video.addEventListener('error', () => reject(new Error('Video could not be decoded for frame sampling')), { once: true });
    });
  }

  private unloadSource(): void {
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    this.loadedSource = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private seek(video: HTMLVideoElement, seconds: number): Promise<void> {
    // A video whose duration is unknown (streamed containers) is asked
    // for the timestamp as given; the element clamps it itself.
    const target = Number.isFinite(video.duration)
      ? Math.min(Math.max(seconds, 0), Math.max(0, video.duration - 0.05))
      : Math.max(seconds, 0);
    if (Math.abs(video.currentTime - target) < 0.001) return Promise.resolve();
    return new Promise((resolve, reject) => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new Error('Video failed while seeking for a frame')), { once: true });
      video.currentTime = target;
    });
  }

  private draw(video: HTMLVideoElement): string {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (sourceWidth === 0 || sourceHeight === 0) throw new Error('Video has no decoded frames yet');
    const scale = Math.min(1, this.maxWidth / sourceWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas context unavailable');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', this.quality);
  }
}
