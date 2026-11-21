import type { FootagePicture } from '@modules/video/FootagePicture';

/** One decoded frame of an animation, drawable until it is closed. */
export interface AnimationFrame extends FootagePicture {
  close(): void;
}

/**
 * Decodes the frames of one animation by index, in any order. Each
 * frame is decoded whole — whatever earlier frames it builds on already
 * drawn into it.
 */
export interface AnimationFrameDecoder {
  readonly frameCount: number;
  /** The animation's displayed size, in pixels. */
  readonly width: number;
  readonly height: number;

  /** Rejects when the frame cannot be decoded. The caller closes what it is handed. */
  decode(frameIndex: number): Promise<AnimationFrame>;

  close(): void;
}
