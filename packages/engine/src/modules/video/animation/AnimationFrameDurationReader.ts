/** How an animated image plays: how long each frame lasts, and how many times the whole runs. */
export interface AnimationTiming {
  /** One duration per frame, in seconds and in order. */
  readonly frameDurationsSec: number[];
  /** How many times the animation runs before it holds its last frame; `Infinity` for one that loops forever. */
  readonly playCount: number;
}

/** Reads how an animated image plays, from the file's bytes. */
export interface AnimationFrameDurationReader {
  /** The file's timing; null when the bytes are not of a format this reads. */
  read(bytes: Uint8Array): AnimationTiming | null;
}
