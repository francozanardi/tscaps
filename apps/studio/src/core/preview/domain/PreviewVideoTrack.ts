import type { PreviewVideoFrame } from '@core/preview/domain/PreviewVideoFrame';

/**
 * Read access to the decoded video frames of an opened source.
 * Source positions are in seconds against the source video's own
 * timeline; no cut awareness — the caller filters or skips ranges
 * as needed.
 *
 * `streamFrames` yields frames in presentation order starting at
 * or before the requested timestamp (a decoder may emit a few
 * frames from the prior keyframe; the caller drops them). Every
 * yielded frame is standalone (see {@link PreviewVideoFrame}) —
 * the caller owns it until it calls `close`.
 * `getFrameAt` returns the single frame that should be on screen
 * at the requested timestamp, or `null` if the timestamp is past
 * the end of the track.
 * `openScrubSession` returns a session that holds a single
 * decoder warm for as long as the caller drags the playhead,
 * pushing each new target through {@link PreviewScrubSession}
 * instead of opening a fresh decoder per tick.
 */
export interface PreviewVideoTrack {
  streamFrames(startSourceSec: number): AsyncIterable<PreviewVideoFrame>;
  getFrameAt(sourceSec: number): Promise<PreviewVideoFrame | null>;
  openScrubSession(): PreviewScrubSession;
}

/**
 * Interactive scrub channel against a {@link PreviewVideoTrack}.
 * One persistent decoder backs the whole session; the caller
 * feeds the latest target through {@link scrubTo} and consumes
 * the matching frames by iterating over {@link frames}.
 *
 * Targets are coalesced: while the decoder is busy with the
 * previous target, repeated `scrubTo` calls keep only the
 * latest position, so a fast drag does not pile up stale work.
 *
 * The final pushed target's frame is emitted when {@link close}
 * is called, which finalises the underlying decoder and
 * releases its WebCodecs context. The caller must always close
 * the session, even on abort.
 */
export interface PreviewScrubSession {
  scrubTo(sourceSec: number): void;
  frames(): AsyncIterable<PreviewVideoFrame>;
  close(): void;
}
