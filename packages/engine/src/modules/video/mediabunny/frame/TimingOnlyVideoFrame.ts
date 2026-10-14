import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';

/** A frame known only by when it is shown. Drawing it throws, since there is nothing to draw. */
export class TimingOnlyVideoFrame implements DecodedVideoFrame {

  constructor(readonly timestamp: number, readonly duration: number) {}

  draw(): void {
    throw new Error('This frame was never decoded: it carries timing only.');
  }

  close(): void {}
}
