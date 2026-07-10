/**
 * Extracts the first non-black frame of a video file as a JPEG Blob, suitable
 * for use as a dashboard thumbnail. Seeks slightly past zero (default 0.1s)
 * because many videos start on a literal black frame; tune via constructor.
 *
 * Each call mounts a detached `<video>` element in memory, decodes the
 * requested frame, draws it to a canvas, and exports a JPEG blob. The
 * temporary URL and element are cleaned up before the promise resolves.
 */
export class ThumbnailGenerator {
  constructor(
    private readonly seekSeconds: number = 0.1,
    private readonly maxWidth: number = 480,
    private readonly quality: number = 0.7,
  ) {}

  generate(source: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(source);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
      };

      video.addEventListener('loadedmetadata', () => {
        const target = Math.min(this.seekSeconds, Math.max(0, video.duration - 0.05));
        video.currentTime = target;
      });

      video.addEventListener('seeked', () => {
        try {
          const blob = this.captureFrame(video);
          cleanup();
          blob.then(resolve).catch(reject);
        } catch (err) {
          cleanup();
          reject(err);
        }
      }, { once: true });

      video.addEventListener('error', () => {
        cleanup();
        reject(new Error('Failed to load video for thumbnail generation'));
      });
    });
  }

  private captureFrame(video: HTMLVideoElement): Promise<Blob> {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (sourceWidth === 0 || sourceHeight === 0) {
      return Promise.reject(new Error('Video has no decoded frames yet'));
    }
    const scale = Math.min(1, this.maxWidth / sourceWidth);
    const targetWidth = Math.round(sourceWidth * scale);
    const targetHeight = Math.round(sourceHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('2D canvas context unavailable'));
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
        'image/jpeg',
        this.quality,
      );
    });
  }
}
