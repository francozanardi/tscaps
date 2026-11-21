/** An audio region, in absolute seconds, that no pipeline window transcribed. */
export interface CoverageGap {
  startSeconds: number;
  endSeconds: number;
  /**
   * Whether one re-decode over real audio may recover the region.
   * False when the window's output was cut from outside — loop guard
   * or token ceiling — because retrying reproduces the failure.
   */
  rescuable: boolean;
}

interface WindowRecord {
  lastClosedEndSeconds: number | null;
  tokenCount: number;
  abortedByLoopGuard: boolean;
  /** Where the segment the window left open starts, or `null` when its last segment was closed. */
  openSegmentStartSeconds: number | null;
}

/**
 * Records what the decoder did in each pipeline window — how far its
 * last real segment got, how many tokens it emitted, whether the loop
 * guard cut it, whether it stopped mid-segment — and answers which
 * audio regions were left uncovered.
 *
 * Segment boundaries are counted with window-local parity: within one
 * window the decoder strictly alternates open / close starting at
 * open, so odd-numbered events open a segment and even-numbered ones
 * close it. The upstream streamer's own open/close labels are not
 * trusted — its alternation state carries across windows, so one
 * window that stops mid-segment mislabels every event that follows.
 *
 * Only segments whose close timestamp is strictly greater than their
 * open timestamp count as "closed". A degenerate repetition loop can
 * emit `<|t|>text<|t|>` pairs at a single timestamp forever — trusting
 * those bogus closes leaves the whole loop tail looking legitimate
 * and defeats every downstream cutoff.
 */
export class WhisperWindowCoverage {
  private readonly windows: WindowRecord[] = [];
  private currentLastClosedEnd: number | null = null;
  private currentTokenCount = 0;
  private currentTimestampEvents = 0;
  private currentOpenTimestamp: number | null = null;

  /** Feeds one segment-boundary timestamp, relative to the current window. */
  recordTimestamp(timeWithinWindow: number): void {
    this.currentTimestampEvents += 1;
    if (this.isOpenEvent()) {
      this.currentOpenTimestamp = timeWithinWindow;
      return;
    }
    if (this.isRealClose(timeWithinWindow)) {
      this.currentLastClosedEnd = Math.max(this.currentLastClosedEnd ?? 0, timeWithinWindow);
    }
    this.currentOpenTimestamp = null;
  }

  private isOpenEvent(): boolean {
    return this.currentTimestampEvents % 2 === 1;
  }

  private isRealClose(closeTimestamp: number): boolean {
    return this.currentOpenTimestamp !== null && closeTimestamp > this.currentOpenTimestamp;
  }

  /** Counts one generated token towards the current window. */
  recordToken(): void {
    this.currentTokenCount += 1;
  }

  /** Marks the end of the current window's generation pass. */
  windowEnded(abortedByLoopGuard: boolean): void {
    this.windows.push({
      lastClosedEndSeconds: this.currentLastClosedEnd,
      tokenCount: this.currentTokenCount,
      abortedByLoopGuard,
      openSegmentStartSeconds: this.isOpenEvent() ? this.currentOpenTimestamp : null,
    });
    this.currentLastClosedEnd = null;
    this.currentTokenCount = 0;
    this.currentTimestampEvents = 0;
    this.currentOpenTimestamp = null;
  }

  /** Number of generation passes observed so far. */
  get windowsObserved(): number {
    return this.windows.length;
  }

  /**
   * The uncovered regions among non-final windows. A window whose
   * trustworthy coverage ends before the pipeline's window advance
   * leaves the audio from that point up to the next window's start
   * transcribed by nobody.
   *
   * A window is degenerate when the loop guard cut it or its token
   * count reached `tokenCeiling` — either way it did not end by its
   * own end-of-sequence, and its gap is not rescuable.
   */
  uncoveredGaps(advanceSeconds: number, tokenCeiling: number): CoverageGap[] {
    const gaps: CoverageGap[] = [];
    for (let window = 0; window < this.windows.length - 1; window++) {
      const record = this.windows[window];
      if (!record) continue;
      const degenerate = this.isDegenerate(record, tokenCeiling);
      const gapStart = this.gapStartFor(record, degenerate);
      if (gapStart === null || gapStart >= advanceSeconds) continue;
      gaps.push({
        startSeconds: window * advanceSeconds + gapStart,
        endSeconds: (window + 1) * advanceSeconds,
        rescuable: !degenerate,
      });
    }
    return gaps;
  }

  /**
   * The uncovered tail of the final window, or `null` when there is
   * nothing trustworthy to report. Reported only when that window's
   * generation was cut from outside or stopped mid-segment. A clean
   * close is trusted as the genuine end of speech: with no following
   * window, an early-but-clean close cannot be told apart from a video
   * that simply ends in silence.
   *
   * A window that stopped by its own end-of-sequence with a segment
   * left open is the decoder saying where it stopped, not that the
   * speech ended: the tail from where that segment starts is rescuable,
   * which is where the reference decoder resumes from. When that is the
   * window's own start there is no tail: decoding again from there
   * reads the same audio, so what the window wrote is kept as it is.
   * A window cut from outside is not rescuable, and its tail starts at
   * its last closed segment.
   */
  finalWindowGap(advanceSeconds: number, tokenCeiling: number, audioEndSeconds: number): CoverageGap | null {
    const record = this.windows[this.windows.length - 1];
    if (!record) return null;
    const degenerate = this.isDegenerate(record, tokenCeiling);
    const tailStart = this.finalTailStartFor(record, degenerate);
    if (tailStart === null) return null;
    const startSeconds = (this.windows.length - 1) * advanceSeconds + tailStart;
    if (startSeconds >= audioEndSeconds) return null;
    return { startSeconds, endSeconds: audioEndSeconds, rescuable: !degenerate };
  }

  /**
   * Where the final window's untrusted tail starts, window-relative,
   * or `null` when the window closed cleanly.
   */
  private finalTailStartFor(record: WindowRecord, degenerate: boolean): number | null {
    const lastClosedEnd = record.lastClosedEndSeconds ?? 0;
    if (degenerate) return lastClosedEnd;
    if (record.openSegmentStartSeconds === null) return null;
    const resumeFrom = Math.max(lastClosedEnd, record.openSegmentStartSeconds);
    return resumeFrom > 0 ? resumeFrom : null;
  }

  private isDegenerate(record: WindowRecord, tokenCeiling: number): boolean {
    return record.abortedByLoopGuard || record.tokenCount >= tokenCeiling;
  }

  /**
   * Where the window's trustworthy coverage ends. A clean window that
   * closed no segment reports `null`: re-decoding its identical input
   * is deterministic and would reproduce the same empty result. A
   * degenerate window with no closed segment still gaps from zero —
   * its region gets dropped, not re-decoded.
   */
  private gapStartFor(record: WindowRecord, degenerate: boolean): number | null {
    if (record.lastClosedEndSeconds !== null) return record.lastClosedEndSeconds;
    return degenerate ? 0 : null;
  }
}
