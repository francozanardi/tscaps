// banned-words-allow-file: close
import { Line, NarrationPace, Segment, TimeFragment, Word } from '@tscaps/engine';
import type { CharOwnership } from '@core/editor/captions/domain/CharOwnership';

export interface NeighborWindow {
  readonly prevEnd: number;
  readonly nextStart: number;
}

interface TokenSpan {
  readonly text: string;
  readonly lineIdx: number;
  readonly charStart: number;
  readonly charEnd: number;
}

interface ResolvedToken {
  span: TokenSpan;
  origin: Word | null;
  speakerId: string | null;
}

interface TimedToken {
  resolved: ResolvedToken;
  start: number;
  end: number;
}

interface AssignedTimes {
  readonly tokens: TimedToken[];
  readonly segmentStart: number;
  readonly segmentEnd: number;
}

/**
 * Rebuilds a Segment from a textarea snapshot: anchors carry their
 * original time/id forward, inserts get pace-derived times, and the
 * segment span is extended only as far as the neighbor window allows.
 */
export class SegmentRecompiler {
  recompile(args: {
    segment: Segment;
    finalText: string;
    finalOwnership: CharOwnership;
    pace: NarrationPace;
    neighbors: NeighborWindow;
  }): Segment {
    const { segment, finalText, finalOwnership, pace, neighbors } = args;

    const spans = this._tokenize(finalText);
    if (spans.length === 0) {
      const emptyWord = new Word({ text: '', time: segment.time });
      const emptyLine = new Line({ words: [emptyWord] });
      return new Segment({ lines: [emptyLine], id: segment.id, customTime: segment.time });
    }

    const originalById = this._indexWordsById(segment);
    const resolved = this._resolveIdentities(spans, finalOwnership, originalById);
    const assigned = this._assignTimes(resolved, segment, pace, neighbors);
    return this._buildSegment(assigned, segment);
  }

  private _tokenize(text: string): TokenSpan[] {
    const spans: TokenSpan[] = [];
    let lineIdx = 0;
    let i = 0;
    while (i < text.length) {
      const ch = text.charCodeAt(i);
      if (ch === 0x0a) {
        lineIdx++;
        i++;
        continue;
      }
      if (ch === 0x20 || ch === 0x09 || ch === 0x0d) {
        i++;
        continue;
      }
      const start = i;
      while (i < text.length) {
        const c = text.charCodeAt(i);
        if (c === 0x0a || c === 0x20 || c === 0x09 || c === 0x0d) break;
        i++;
      }
      spans.push({ text: text.slice(start, i), lineIdx, charStart: start, charEnd: i });
    }
    return spans;
  }

  private _indexWordsById(segment: Segment): Map<string, Word> {
    const m = new Map<string, Word>();
    for (const line of segment.lines) {
      for (const word of line.words) {
        if (word.text.length > 0) m.set(word.id, word);
      }
    }
    return m;
  }

  private _resolveIdentities(
    spans: TokenSpan[],
    ownership: CharOwnership,
    originalById: Map<string, Word>,
  ): ResolvedToken[] {
    const claimed = new Set<string>();
    const result: ResolvedToken[] = [];
    for (const span of spans) {
      const tally = new Map<string, number>();
      for (let i = span.charStart; i < span.charEnd; i++) {
        const id = ownership.mapping[i];
        if (!id) continue;
        tally.set(id, (tally.get(id) ?? 0) + 1);
      }
      let bestId: string | null = null;
      let bestCount = 0;
      for (const [id, count] of tally) {
        if (count > bestCount) {
          bestCount = count;
          bestId = id;
        }
      }
      const tokenLen = span.charEnd - span.charStart;
      const majorityNeeded = Math.ceil(tokenLen / 2);
      let origin: Word | null = null;
      if (bestId && bestCount >= majorityNeeded && !claimed.has(bestId)) {
        const candidate = originalById.get(bestId);
        if (candidate) {
          origin = candidate;
          claimed.add(bestId);
        }
      }
      result.push({ span, origin, speakerId: origin?.speakerId ?? null });
    }
    let lastSpeaker: string | null = null;
    for (const token of result) {
      if (token.origin) lastSpeaker = token.origin.speakerId ?? null;
      else if (lastSpeaker !== null) token.speakerId = lastSpeaker;
    }
    lastSpeaker = null;
    for (let i = result.length - 1; i >= 0; i--) {
      const token = result[i]!;
      if (token.origin) lastSpeaker = token.origin.speakerId ?? null;
      else if (token.speakerId === null && lastSpeaker !== null) token.speakerId = lastSpeaker;
    }
    return result;
  }

  private _assignTimes(
    tokens: ResolvedToken[],
    segment: Segment,
    pace: NarrationPace,
    neighbors: NeighborWindow,
  ): AssignedTimes {
    const naturals = tokens.map((t) => this._naturalDuration(t, pace));
    const naturalTotal = naturals.reduce((a, b) => a + b, 0);
    const lowerBound = neighbors.prevEnd;
    const upperBound = Math.max(lowerBound, neighbors.nextStart);
    const maxSpan = upperBound - lowerBound;

    const anchorIndices: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i]!.origin) anchorIndices.push(i);
    }

    if (anchorIndices.length > 0) {
      const preserved = this._tryPreserveAnchors(tokens, naturals, anchorIndices, lowerBound, upperBound);
      if (preserved) return preserved;
    }

    // Fallback: every token (anchors included) shares the segment's
    // available window proportional to its natural duration. Triggered
    // whenever anchor preservation would leave an insert with no room —
    // typing into a tight segment shrinks the existing words instead of
    // collapsing the new ones.
    return this._distributeProportional(tokens, naturals, naturalTotal, segment, lowerBound, upperBound, maxSpan);
  }

  private _tryPreserveAnchors(
    tokens: ResolvedToken[],
    naturals: number[],
    anchorIndices: number[],
    lowerBound: number,
    upperBound: number,
  ): AssignedTimes | null {
    const firstAnchor = anchorIndices[0]!;
    const lastAnchor = anchorIndices[anchorIndices.length - 1]!;

    if (firstAnchor > 0) {
      const upper = tokens[firstAnchor]!.origin!.time.start;
      const desired = this._sumRange(naturals, 0, firstAnchor);
      if (upper - lowerBound < desired) return null;
    }
    for (let a = 0; a < anchorIndices.length - 1; a++) {
      const leftIdx = anchorIndices[a]!;
      const rightIdx = anchorIndices[a + 1]!;
      if (rightIdx - leftIdx <= 1) continue;
      const lower = tokens[leftIdx]!.origin!.time.end;
      const upper = tokens[rightIdx]!.origin!.time.start;
      const desired = this._sumRange(naturals, leftIdx + 1, rightIdx);
      if (upper - lower < desired) return null;
    }
    if (lastAnchor < tokens.length - 1) {
      const lower = tokens[lastAnchor]!.origin!.time.end;
      const desired = this._sumRange(naturals, lastAnchor + 1, tokens.length);
      if (upperBound - lower < desired) return null;
    }

    const timed: TimedToken[] = new Array(tokens.length);
    for (const idx of anchorIndices) {
      const t = tokens[idx]!;
      const w = t.origin!;
      timed[idx] = { resolved: t, start: w.time.start, end: w.time.end };
    }

    if (firstAnchor > 0) {
      const upper = tokens[firstAnchor]!.origin!.time.start;
      const desired = this._sumRange(naturals, 0, firstAnchor);
      this._placeNatural(tokens, naturals, 0, firstAnchor, upper - desired, timed);
    }
    for (let a = 0; a < anchorIndices.length - 1; a++) {
      const leftIdx = anchorIndices[a]!;
      const rightIdx = anchorIndices[a + 1]!;
      if (rightIdx - leftIdx <= 1) continue;
      const lower = tokens[leftIdx]!.origin!.time.end;
      this._placeNatural(tokens, naturals, leftIdx + 1, rightIdx, lower, timed);
    }
    if (lastAnchor < tokens.length - 1) {
      const lower = tokens[lastAnchor]!.origin!.time.end;
      this._placeNatural(tokens, naturals, lastAnchor + 1, tokens.length, lower, timed);
    }

    return {
      tokens: timed,
      segmentStart: timed[0]!.start,
      segmentEnd: timed[timed.length - 1]!.end,
    };
  }

  private _distributeProportional(
    tokens: ResolvedToken[],
    naturals: number[],
    naturalTotal: number,
    segment: Segment,
    lowerBound: number,
    upperBound: number,
    maxSpan: number,
  ): AssignedTimes {
    const blockSpan = Math.min(naturalTotal, maxSpan);
    const scale = naturalTotal > 0 ? blockSpan / naturalTotal : 0;

    // Keep the block as close to the segment's original start as the
    // available window allows. Anchors near their original times after
    // the proportional shrink stay visually close to the audio.
    let start = segment.time.start;
    if (start + blockSpan > upperBound) start = upperBound - blockSpan;
    if (start < lowerBound) start = lowerBound;

    const timed: TimedToken[] = [];
    let cursor = start;
    for (let i = 0; i < tokens.length; i++) {
      const dur = naturals[i]! * scale;
      timed.push({ resolved: tokens[i]!, start: cursor, end: cursor + dur });
      cursor += dur;
    }

    return {
      tokens: timed,
      segmentStart: timed[0]!.start,
      segmentEnd: timed[timed.length - 1]!.end,
    };
  }

  private _placeNatural(
    tokens: ResolvedToken[],
    naturals: number[],
    fromIdx: number,
    toIdx: number,
    lower: number,
    out: TimedToken[],
  ): void {
    let cursor = lower;
    for (let i = fromIdx; i < toIdx; i++) {
      out[i] = { resolved: tokens[i]!, start: cursor, end: cursor + naturals[i]! };
      cursor += naturals[i]!;
    }
  }

  private _sumRange(values: number[], fromIdx: number, toIdx: number): number {
    let total = 0;
    for (let i = fromIdx; i < toIdx; i++) total += values[i]!;
    return total;
  }

  private _naturalDuration(token: ResolvedToken, pace: NarrationPace): number {
    if (token.origin) return token.origin.time.end - token.origin.time.start;
    const cps = pace.charsPerSecond(token.speakerId);
    return cps > 0 ? token.span.text.length / cps : 0;
  }

  private _buildSegment(assigned: AssignedTimes, original: Segment): Segment {
    const byLine = new Map<number, Word[]>();
    for (const tt of assigned.tokens) {
      const t = tt.resolved;
      // Fresh `new Word(...)` rather than `.with({ text })` so the
      // optional `displayText` falls back to the new text; `.with()`
      // would carry the old displayText forward.
      const word = t.origin
        ? new Word({
            text: t.span.text,
            time: new TimeFragment(tt.start, tt.end),
            structureTags: t.origin.structureTags,
            semanticTags: t.origin.semanticTags,
            id: t.origin.id,
            speakerId: t.origin.speakerId,
          })
        : new Word({
            text: t.span.text,
            time: new TimeFragment(tt.start, tt.end),
            speakerId: t.speakerId,
          });
      const bucket = byLine.get(t.span.lineIdx) ?? [];
      bucket.push(word);
      byLine.set(t.span.lineIdx, bucket);
    }
    const lines = Array.from(byLine.keys())
      .sort((a, b) => a - b)
      .map((idx) => new Line({ words: byLine.get(idx)! }));
    return new Segment({
      lines,
      id: original.id,
      customTime: new TimeFragment(assigned.segmentStart, assigned.segmentEnd),
    });
  }
}
