/**
 * Drives an HTML video element through a sequence of timestamps,
 * awaiting each `seeked` event before yielding control. Wraps the
 * DOM event lifecycle in a plain awaitable so callers can `await`
 * a seek without wiring listeners each time.
 */
export class VideoFrameSeeker {

  seekTo(video: HTMLVideoElement, timestamp: number): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = (): void => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = timestamp;
    });
  }
}
