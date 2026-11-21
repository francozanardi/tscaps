import type { FootagePicture } from '@modules/video/FootagePicture';

/**
 * One layer's footage, open for as long as its stretch runs.
 * `width × height` is the picture's own displayed size.
 */
export interface OpenedFootage {
  readonly width: number;
  readonly height: number;

  /**
   * The picture at `sourceSec` of the footage, or null when it holds none.
   * It stays drawable until the next question or {@link close}. Moments
   * are expected to advance; an earlier one costs reading again.
   */
  pictureAt(sourceSec: number): Promise<FootagePicture | null>;

  close(): Promise<void>;
}
