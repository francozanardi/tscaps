/**
 * Tells a WebKit older than release 26 (Safari 26, iOS and iPadOS 26)
 * apart from a newer one.
 *
 * Asked only of a host already known to run WebKit; anywhere else the
 * answer means nothing. Fixed for the host: every call gives the same
 * answer.
 */
export interface WebKitReleaseDetector {
  isBefore26(): boolean;
}
