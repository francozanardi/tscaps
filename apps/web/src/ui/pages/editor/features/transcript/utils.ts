import type { Document, Segment } from '@tscaps/engine';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ds = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

export interface WordTimeBounds {
  readonly prevEnd: number;
  readonly nextStart: number;
}

/**
 * Visual slider stops for a single word's timing edit. Inside the segment,
 * the bounds are the adjacent non-empty words. At the edges, the bounds
 * extend to the neighbor *segment* (not the current segment's own start/
 * end), so dragging the first/last word past the current segment boundary
 * grows the slider's free space instead of collapsing it as the segment
 * auto-shrinks/grows around the word.
 */
export function wordTimeBoundsInSegment(
  doc: Document,
  segment: Segment,
  wordId: string,
  videoDuration: number,
): WordTimeBounds {
  const flat = segment.lines.flatMap((l) => l.words);
  const idx = flat.findIndex((w) => w.id === wordId);
  if (idx < 0) {
    return { prevEnd: segment.time.start, nextStart: segment.time.end };
  }

  let prevEnd: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    const w = flat[i]!;
    if (w.text.length > 0) { prevEnd = w.time.end; break; }
  }
  let nextStart: number | null = null;
  for (let i = idx + 1; i < flat.length; i++) {
    const w = flat[i]!;
    if (w.text.length > 0) { nextStart = w.time.start; break; }
  }

  if (prevEnd === null || nextStart === null) {
    const segments = doc.getSegments();
    const segIdx = segments.findIndex((s) => s.id === segment.id);
    if (prevEnd === null) {
      const prevSeg = segIdx > 0 ? segments[segIdx - 1] : null;
      prevEnd = prevSeg ? prevSeg.time.end : 0;
    }
    if (nextStart === null) {
      const nextSeg = segIdx >= 0 ? segments[segIdx + 1] : null;
      nextStart = nextSeg ? nextSeg.time.start : Math.max(segment.time.end, videoDuration);
    }
  }

  return { prevEnd, nextStart };
}
