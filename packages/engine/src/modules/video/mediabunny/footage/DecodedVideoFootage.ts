import type { Input } from 'mediabunny';
import type { FootagePicture } from '@modules/video/FootagePicture';
import type { FootageDecodeCursor } from '@modules/video/mediabunny/footage/FootageDecodeCursor';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';

/**
 * {@link OpenedFootage} over a video decoded frame by frame: the picture
 * at a moment is the frame on screen then, held by the cursor until the
 * next question. Closing it closes the decoder and the file.
 */
export class DecodedVideoFootage implements OpenedFootage {
  constructor(
    private readonly input: Input,
    private readonly cursor: FootageDecodeCursor,
    readonly width: number,
    readonly height: number,
  ) {}

  pictureAt(sourceSec: number): Promise<FootagePicture | null> {
    return this.cursor.frameAt(sourceSec);
  }

  async close(): Promise<void> {
    await this.cursor.close();
    this.input.dispose();
  }
}
