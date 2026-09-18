/**
 * The condition underneath a failure, named generally enough that
 * every operation able to hit it reports the same one.
 *
 * An error says which operation failed; this says what stopped it.
 * Both are needed to tell someone anything useful: the same condition
 * means different things depending on what it interrupted, and the
 * same operation calls for different advice depending on what stopped
 * it.
 *
 * `unknown` is the honest answer when no rule recognises the cause,
 * and is what most failures resolve to.
 */
export type FailureReason =
  | 'storage-full'
  | 'not-found'
  | 'codec-unsupported'
  | 'backend-unavailable'
  | 'network-unreachable'
  | 'unknown';
