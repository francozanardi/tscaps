/**
 * The facts a validator judges a video by. `durationSeconds` is
 * whichever reading the caller trusts — the metadata probe's is more
 * accurate than the `<video>` element's. `isSourceReadable` is `null`
 * when nothing probed the bytes, which is not `false` (refused).
 */
export interface VideoCandidate {
  readonly durationSeconds: number;
  readonly isSourceReadable: boolean | null;
}
