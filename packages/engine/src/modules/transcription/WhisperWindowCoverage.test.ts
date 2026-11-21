import { describe, expect, it } from 'vitest';
import { WhisperWindowCoverage } from '@modules/transcription/WhisperWindowCoverage';

const ADVANCE = 20;
const TOKEN_CEILING = 444;

function recordSegment(coverage: WhisperWindowCoverage, openSeconds: number, closeSeconds: number): void {
  coverage.recordTimestamp(openSeconds);
  coverage.recordTimestamp(closeSeconds);
}

function tokens(coverage: WhisperWindowCoverage, count: number): void {
  for (let i = 0; i < count; i++) coverage.recordToken();
}

describe('WhisperWindowCoverage', () => {

  it('reports no gap for a clean window that closed past the advance', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    expect(coverage.uncoveredGaps(ADVANCE, TOKEN_CEILING)).toEqual([]);
  });

  it('reports a rescuable gap for a clean window that closed early', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 15);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    expect(coverage.uncoveredGaps(ADVANCE, TOKEN_CEILING)).toEqual([
      { startSeconds: 15, endSeconds: ADVANCE, rescuable: true },
    ]);
  });

  it('reports a non-rescuable gap when the loop guard aborted the window', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 15);
    tokens(coverage, 60);
    coverage.windowEnded(true);
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    expect(coverage.uncoveredGaps(ADVANCE, TOKEN_CEILING)).toEqual([
      { startSeconds: 15, endSeconds: ADVANCE, rescuable: false },
    ]);
  });

  it('ignores fake closes where open equals close (loop stuck at a single timestamp)', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 15);
    for (let i = 0; i < 20; i++) recordSegment(coverage, 30, 30);
    tokens(coverage, TOKEN_CEILING);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    expect(coverage.uncoveredGaps(ADVANCE, TOKEN_CEILING)).toEqual([
      { startSeconds: 15, endSeconds: ADVANCE, rescuable: false },
    ]);
  });

  it('finalWindowGap returns null for a clean last window', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 25);
    tokens(coverage, 40);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 25)).toBeNull();
  });

  it('finalWindowGap reports the tail as non-rescuable when the last window hit the token ceiling', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 25);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 20);
    for (let i = 0; i < 30; i++) recordSegment(coverage, 30, 30);
    tokens(coverage, TOKEN_CEILING);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 45)).toEqual({
      startSeconds: 40,
      endSeconds: 45,
      rescuable: false,
    });
  });

  it('finalWindowGap reports the tail as rescuable when the last window stopped mid-segment', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 15);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 4);
    coverage.recordTimestamp(4);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 30)).toEqual({
      startSeconds: 24,
      endSeconds: 30,
      rescuable: true,
    });
  });

  it('finalWindowGap returns null when the last window left open the segment it started with', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 15);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    coverage.recordTimestamp(0);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 30)).toBeNull();
  });

  it('finalWindowGap starts the tail of audio that fits in one window where the segment left open starts', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 5.5);
    recordSegment(coverage, 5.5, 8.56);
    coverage.recordTimestamp(8.56);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 13.9)).toEqual({
      startSeconds: 8.56,
      endSeconds: 13.9,
      rescuable: true,
    });
  });

  it('finalWindowGap keeps the tail non-rescuable when the loop guard cut a window that stopped mid-segment', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 6);
    coverage.recordTimestamp(9);
    tokens(coverage, 80);
    coverage.windowEnded(true);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 14)).toEqual({
      startSeconds: 6,
      endSeconds: 14,
      rescuable: false,
    });
  });

  it('finalWindowGap returns null when the trustworthy tail already covers the audio end', () => {
    const coverage = new WhisperWindowCoverage();
    recordSegment(coverage, 0, 25);
    tokens(coverage, 30);
    coverage.windowEnded(false);
    recordSegment(coverage, 0, 25);
    tokens(coverage, TOKEN_CEILING);
    coverage.windowEnded(false);
    expect(coverage.finalWindowGap(ADVANCE, TOKEN_CEILING, 45)).toBeNull();
  });

  it('windowsObserved counts every windowEnded call', () => {
    const coverage = new WhisperWindowCoverage();
    coverage.windowEnded(false);
    coverage.windowEnded(false);
    coverage.windowEnded(true);
    expect(coverage.windowsObserved).toBe(3);
  });
});
