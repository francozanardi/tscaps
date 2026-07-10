/**
 * Snapshots the current frame of a video element as an ImageBitmap
 * that can be transferred to a Worker without copying the pixels.
 * The video is expected to be paused on the target frame — callers
 * pair this with a seek + `seeked` wait.
 */
export class VideoFrameBitmapCapturer {

  async capture(video: HTMLVideoElement): Promise<ImageBitmap> {
    return createImageBitmap(video);
  }
}
