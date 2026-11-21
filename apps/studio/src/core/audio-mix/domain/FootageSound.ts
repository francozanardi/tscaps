/**
 * A shot layer whose file's own sound is heard while it shows, and how
 * loud: linear, above 0 and up to 2. A layer without one plays in
 * silence, its level 0.
 */
export interface FootageSound {
  readonly layerId: string;
  readonly volume: number;
}
