/**
 * Loads a video from a URL into an off-screen `<video>` element and
 * resolves once the first frame is decoded. The returned element is
 * ready to be seeked; the caller is responsible for calling
 * `dispose` when done to release the DOM node.
 *
 * The element is created outside the document tree so it never
 * intercepts layout or events. Playback attributes are set for
 * `preload='auto'` and muted so browsers do not gate frame decoding
 * on user interaction.
 */
export class HiddenVideoLoader {

  async load(url: string): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await this.waitForFirstFrame(video);
    return video;
  }

  dispose(video: HTMLVideoElement): void {
    video.removeAttribute('src');
    video.load();
  }

  private waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onError);
      };
      const onLoaded = (): void => {
        cleanup();
        resolve();
      };
      const onError = (): void => {
        cleanup();
        reject(video.error ?? new Error('Hidden video failed to load'));
      };
      video.addEventListener('loadeddata', onLoaded);
      video.addEventListener('error', onError);
    });
  }
}
