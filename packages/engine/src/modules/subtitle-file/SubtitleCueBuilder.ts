import { TimeFragment } from '@modules/document/TimeFragment';
import type { Document } from '@modules/document/Document';
import type { Line } from '@modules/document/Line';
import type { Segment } from '@modules/document/Segment';
import { RenderTimeMap, type TimeRange } from '@modules/video/RenderTimeMap';
import { SubtitleCue } from '@modules/subtitle-file/SubtitleCue';
import { SubtitleRow } from '@modules/subtitle-file/SubtitleRow';
import { SubtitleToken } from '@modules/subtitle-file/SubtitleToken';

/**
 * Turns a document into the ordered, self-consistent cue list every
 * subtitle format is written from, so no format has to rediscover the
 * same corrections:
 *
 * - Cues come out sorted by start, because document order is not time
 *   order and segments may overlap.
 * - A segment holding an explicit time keeps it, so a phrase held on
 *   screen past its narration lasts as long in the file.
 * - Words with no text drop out, and so does anything left covering an
 *   empty window — a window of no length never becomes current during
 *   playback, so an entry for it is one no player would ever show.
 * - A `hidden` segment never becomes a cue, so the file shows what a
 *   render shows.
 * - Excluded windows rebase every time, cue and token alike, onto the
 *   timeline a render leaves behind.
 *
 * Text comes from each word's `text` rather than its `displayText`: a
 * subtitle file is read back as content, and the styling passes that
 * rewrite `displayText` state a look rather than a correction.
 */
export class SubtitleCueBuilder {

  build(document: Document, skipRanges: ReadonlyArray<TimeRange>): ReadonlyArray<SubtitleCue> {
    const cues: SubtitleCue[] = [];
    for (const segment of document.getSegments()) {
      if (segment.hidden) continue;
      const cue = this.buildCue(segment);
      if (cue) cues.push(cue);
    }
    const ordered = cues.sort((a, b) => a.time.start - b.time.start);
    if (skipRanges.length === 0) return ordered;
    return this.rebase(ordered, new RenderTimeMap(skipRanges));
  }

  private buildCue(segment: Segment): SubtitleCue | null {
    const rows = this.buildRows(segment);
    if (rows.length === 0) return null;
    const time = this.resolveTime(segment, rows);
    if (time.duration <= 0) return null;
    return new SubtitleCue(time, rows);
  }

  private buildRows(segment: Segment): ReadonlyArray<SubtitleRow> {
    const rows: SubtitleRow[] = [];
    for (const line of segment.lines) {
      const tokens = this.buildTokens(line);
      if (tokens.length > 0) rows.push(new SubtitleRow(tokens));
    }
    return rows;
  }

  private buildTokens(line: Line): ReadonlyArray<SubtitleToken> {
    const tokens: SubtitleToken[] = [];
    for (const word of line.words) {
      const text = word.text.trim();
      if (text.length > 0) tokens.push(new SubtitleToken(text, word.time));
    }
    return tokens;
  }

  private resolveTime(segment: Segment, rows: ReadonlyArray<SubtitleRow>): TimeFragment {
    if (segment.customTime) return segment.customTime;
    if (segment.effectTime) return segment.effectTime;
    return this.spanOf(rows);
  }

  /**
   * Word windows are not guaranteed to be sorted or contiguous, so the
   * span is the outer envelope rather than the first and last entries.
   */
  private spanOf(rows: ReadonlyArray<SubtitleRow>): TimeFragment {
    let start = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      for (const token of row.tokens) {
        if (token.time.start < start) start = token.time.start;
        if (token.time.end > end) end = token.time.end;
      }
    }
    return new TimeFragment(start, end);
  }

  private rebase(
    cues: ReadonlyArray<SubtitleCue>,
    timeMap: RenderTimeMap,
  ): ReadonlyArray<SubtitleCue> {
    const rebased: SubtitleCue[] = [];
    for (const cue of cues) {
      const time = this.rebaseFragment(cue.time, timeMap);
      if (time.duration <= 0) continue;
      rebased.push(new SubtitleCue(time, this.rebaseRows(cue.rows, timeMap)));
    }
    return rebased;
  }

  private rebaseRows(
    rows: ReadonlyArray<SubtitleRow>,
    timeMap: RenderTimeMap,
  ): ReadonlyArray<SubtitleRow> {
    return rows.map((row) => new SubtitleRow(
      row.tokens.map((token) => new SubtitleToken(
        token.text,
        this.rebaseFragment(token.time, timeMap),
      )),
    ));
  }

  private rebaseFragment(fragment: TimeFragment, timeMap: RenderTimeMap): TimeFragment {
    return new TimeFragment(
      timeMap.toOutputTime(fragment.start),
      timeMap.toOutputTime(fragment.end),
    );
  }
}
