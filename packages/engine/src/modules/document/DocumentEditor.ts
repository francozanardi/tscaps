import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { Decoration } from '@modules/document/Decoration';
import { TimeFragment } from '@modules/document/TimeFragment';

export interface WordPosition {
  segIdx: number;
  lineIdx: number;
  wordIdx: number;
}

/**
 * Editing helper: a Segment paired with the Section it belongs to. The
 * Section reference (by identity) is kept across edits so that `rebuild`
 * can re-group consecutive same-section segments and preserve every
 * Section's id + structureTags.
 */
interface SegmentSlot {
  segment: Segment;
  section: Section;
}

/**
 * Pure mutation helpers over Document. All operations preserve Section
 * identity: a manual edit doesn't collapse a multi-Section document into
 * a single Section. A Section that ends up with zero segments is dropped.
 *
 * Cross-section operations (e.g., merging two segments owned by different
 * Sections) keep the result in the FIRST involved Section — the earlier
 * segment's `kind` wins.
 */
export class DocumentEditor {
  findWordById(doc: Document, id: string): WordPosition | null {
    const segments = doc.getSegments();
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si]!;
      for (let li = 0; li < seg.lines.length; li++) {
        const line = seg.lines[li]!;
        for (let wi = 0; wi < line.words.length; wi++) {
          if (line.words[wi]!.id === id) return { segIdx: si, lineIdx: li, wordIdx: wi };
        }
      }
    }
    return null;
  }

  /** Returns the position of the host word for the given decoration id, or `null` when no word carries a decoration with that id. */
  findWordByDecorationId(doc: Document, decorationId: string): WordPosition | null {
    const segments = doc.getSegments();
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si]!;
      for (let li = 0; li < seg.lines.length; li++) {
        const line = seg.lines[li]!;
        for (let wi = 0; wi < line.words.length; wi++) {
          if (line.words[wi]!.decoration?.id === decorationId) return { segIdx: si, lineIdx: li, wordIdx: wi };
        }
      }
    }
    return null;
  }

  computeWordTextSplit(word: Word, rawText: string): Word[] {
    const trimmed = rawText.trim();
    if (!trimmed) return [word];

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return [new Word({
        text: parts[0]!,
        time: word.time,
        structureTags: word.structureTags,
        semanticTags: word.semanticTags,
        id: word.id,
        speakerId: word.speakerId,
        decoration: word.decoration,
        boundaryScore: word.boundaryScore,
        metadata: word.metadata,
      })];
    }

    const totalDuration = word.time.end - word.time.start;
    const totalChars = parts.reduce((sum, p) => sum + p.length, 0);
    let cursor = word.time.start;
    return parts.map((text, i) => {
      const duration = totalDuration * (text.length / totalChars);
      const start = cursor;
      const end = cursor + duration;
      cursor = end;
      const isLast = i === parts.length - 1;
      return new Word({
        text,
        time: new TimeFragment(start, end),
        semanticTags: word.semanticTags,
        id: i === 0 ? word.id : undefined,
        speakerId: word.speakerId,
        decoration: i === 0 ? word.decoration : null,
        boundaryScore: isLast ? word.boundaryScore : null,
        metadata: i === 0 ? word.metadata : undefined,
      });
    });
  }

  replaceWordAt(doc: Document, segIdx: number, lineIdx: number, wordIdx: number, newWords: Word[]): Document {
    return this._replaceWords(doc, segIdx, lineIdx, wordIdx, newWords);
  }

  insertWordAfter(doc: Document, segIdx: number, lineIdx: number, wordIdx: number): { doc: Document; wordId: string } {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return { doc, wordId: '' };
    const line = slot.segment.lines[lineIdx]!;
    const refWord = line.words[wordIdx]!;
    const newWord = new Word({
      text: '',
      time: refWord.time,
      semanticTags: refWord.semanticTags,
      speakerId: refWord.speakerId,
    });
    const newLine = new Line({
      words: [...line.words.slice(0, wordIdx + 1), newWord, ...line.words.slice(wordIdx + 1)],
      structureTags: line.structureTags,
      id: line.id,
    });
    const newDoc = this._replaceLine(doc, segIdx, lineIdx, newLine);
    return { doc: newDoc, wordId: newWord.id };
  }

  /**
   * Inserts a fresh empty Segment adjacent to the anchor at `segIdx`. The
   * new segment lands as a sibling in the same Section (same `kind`, same
   * Section identity). The caller is expected to focus the returned
   * `wordId` so the user can type immediately. If `time` is omitted the
   * new segment clones the anchor's time — callers that want the first
   * keystrokes to claim real duration should pass an explicit window.
   */
  insertSegmentAt(
    doc: Document,
    segIdx: number,
    position: 'before' | 'after',
    time?: TimeFragment,
  ): { doc: Document; wordId: string; segmentId: string } {
    const slots = this._flatten(doc);
    const anchor = slots[segIdx];
    if (!anchor) return { doc, wordId: '', segmentId: '' };

    const newWord = new Word({ text: '', time: time ?? anchor.segment.time });
    const newSegment = new Segment({ lines: [new Line({ words: [newWord] })] });

    const insertIdx = position === 'before' ? segIdx : segIdx + 1;
    const newSlots: SegmentSlot[] = [
      ...slots.slice(0, insertIdx),
      { segment: newSegment, section: anchor.section },
      ...slots.slice(insertIdx),
    ];
    return {
      doc: this._rebuild(newSlots, doc),
      wordId: newWord.id,
      segmentId: newSegment.id,
    };
  }
  
  updateWordTime(doc: Document, segIdx: number, lineIdx: number, wordIdx: number, start: number, end: number): Document {
    const word = doc.getSegments()[segIdx]!.lines[lineIdx]!.words[wordIdx]!;
    return this._replaceWords(doc, segIdx, lineIdx, wordIdx, [
      word.with({ time: new TimeFragment(start, end) }),
    ]);
  }

  /**
   * Returns a Document with the target word carrying `decoration`. Replaces
   * any decoration the word already had. Returns the input Document
   * unchanged when the target word position is out of range.
   */
  setWordDecoration(doc: Document, segIdx: number, lineIdx: number, wordIdx: number, decoration: Decoration): Document {
    const segment = doc.getSegments()[segIdx];
    if (!segment) return doc;
    const line = segment.lines[lineIdx];
    if (!line) return doc;
    const word = line.words[wordIdx];
    if (!word) return doc;
    return this._replaceWords(doc, segIdx, lineIdx, wordIdx, [word.with({ decoration })]);
  }

  /** Returns a Document with the target word's decoration cleared. No-op when the target word carries no decoration. */
  clearWordDecoration(doc: Document, segIdx: number, lineIdx: number, wordIdx: number): Document {
    const segment = doc.getSegments()[segIdx]!;
    const line = segment.lines[lineIdx]!;
    const word = line.words[wordIdx]!;
    if (!word.decoration) return doc;
    return this._replaceWords(doc, segIdx, lineIdx, wordIdx, [word.with({ decoration: null })]);
  }

  deleteWord(doc: Document, segIdx: number, lineIdx: number, wordIdx: number): Document {
    const segment = doc.getSegments()[segIdx]!;
    const line = segment.lines[lineIdx]!;
    const newWords = [...line.words.slice(0, wordIdx), ...line.words.slice(wordIdx + 1)];

    if (newWords.length === 0) return this.deleteLine(doc, segIdx, lineIdx);
    return this._replaceLine(doc, segIdx, lineIdx, new Line({ words: newWords, structureTags: line.structureTags, id: line.id }));
  }

  splitLineAfterWord(doc: Document, segIdx: number, lineIdx: number, wordIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    const line = segment.lines[lineIdx]!;

    if (wordIdx >= line.words.length - 1) return doc;

    const lineA = new Line({ words: line.words.slice(0, wordIdx + 1), structureTags: line.structureTags, id: line.id });
    const lineB = new Line({ words: line.words.slice(wordIdx + 1) });

    const newSegment = this._withLines(segment, [
      ...segment.lines.slice(0, lineIdx),
      lineA,
      lineB,
      ...segment.lines.slice(lineIdx + 1),
    ]);
    return this._replaceSegmentSlot(doc, slots, segIdx, newSegment);
  }

  mergeLineWithNext(doc: Document, segIdx: number, lineIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    if (lineIdx >= segment.lines.length - 1) return doc;

    const lineA = segment.lines[lineIdx]!;
    const lineB = segment.lines[lineIdx + 1]!;
    const merged = new Line({ words: [...lineA.words, ...lineB.words], structureTags: lineA.structureTags, id: lineA.id });

    const newSegment = this._withLines(segment, [
      ...segment.lines.slice(0, lineIdx),
      merged,
      ...segment.lines.slice(lineIdx + 2),
    ]);
    return this._replaceSegmentSlot(doc, slots, segIdx, newSegment);
  }

  deleteLine(doc: Document, segIdx: number, lineIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    const newLines = [...segment.lines.slice(0, lineIdx), ...segment.lines.slice(lineIdx + 1)];

    if (newLines.length === 0) return this.deleteSegment(doc, segIdx);
    return this._replaceSegmentSlot(doc, slots, segIdx, this._withLines(segment, newLines));
  }

  splitSegmentAfterLine(doc: Document, segIdx: number, lineIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    if (lineIdx >= segment.lines.length - 1) return doc;

    const segA = new Segment({ lines: segment.lines.slice(0, lineIdx + 1), structureTags: segment.structureTags, id: segment.id });
    const segB = new Segment({ lines: segment.lines.slice(lineIdx + 1) });

    const newSlots: SegmentSlot[] = [
      ...slots.slice(0, segIdx),
      { segment: segA, section: slot.section },
      { segment: segB, section: slot.section },
      ...slots.slice(segIdx + 1),
    ];
    return this._rebuild(newSlots, doc);
  }

  mergeSegmentWithNext(doc: Document, segIdx: number): Document {
    const slots = this._flatten(doc);
    if (segIdx >= slots.length - 1) return doc;
    const a = slots[segIdx]!;
    const b = slots[segIdx + 1]!;
    const merged = new Segment({ lines: [...a.segment.lines, ...b.segment.lines], structureTags: a.segment.structureTags, id: a.segment.id });

    const newSlots: SegmentSlot[] = [
      ...slots.slice(0, segIdx),
      { segment: merged, section: a.section },
      ...slots.slice(segIdx + 2),
    ];
    return this._rebuild(newSlots, doc);
  }

  moveFirstWordToPrevLine(doc: Document, segIdx: number, lineIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    const line = segment.lines[lineIdx]!;
    const prevLine = segment.lines[lineIdx - 1]!;
    const word = line.words[0]!;
    const newPrevLine = new Line({ words: [...prevLine.words, word], structureTags: prevLine.structureTags, id: prevLine.id });
    const newLineWords = line.words.slice(1);
    const newLines = newLineWords.length === 0
      ? [...segment.lines.slice(0, lineIdx - 1), newPrevLine, ...segment.lines.slice(lineIdx + 1)]
      : [...segment.lines.slice(0, lineIdx - 1), newPrevLine, new Line({ words: newLineWords, structureTags: line.structureTags, id: line.id }), ...segment.lines.slice(lineIdx + 1)];
    return this._replaceSegmentSlot(doc, slots, segIdx, this._withLines(segment, newLines));
  }

  moveLastWordToNextLine(doc: Document, segIdx: number, lineIdx: number): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    const line = segment.lines[lineIdx]!;
    const nextLine = segment.lines[lineIdx + 1]!;
    const word = line.words[line.words.length - 1]!;
    const newNextLine = new Line({ words: [word, ...nextLine.words], structureTags: nextLine.structureTags, id: nextLine.id });
    const newLineWords = line.words.slice(0, -1);
    const newLines = newLineWords.length === 0
      ? [...segment.lines.slice(0, lineIdx), newNextLine, ...segment.lines.slice(lineIdx + 2)]
      : [...segment.lines.slice(0, lineIdx), new Line({ words: newLineWords, structureTags: line.structureTags, id: line.id }), newNextLine, ...segment.lines.slice(lineIdx + 2)];
    return this._replaceSegmentSlot(doc, slots, segIdx, this._withLines(segment, newLines));
  }

  moveFirstWordToPrevSegment(doc: Document, segIdx: number): Document {
    const slots = this._flatten(doc);
    if (segIdx <= 0 || segIdx >= slots.length) return doc;
    const current = slots[segIdx]!.segment;
    const prev = slots[segIdx - 1]!.segment;
    const firstLine = current.lines[0]!;
    const word = firstLine.words[0]!;

    const prevLastLine = prev.lines[prev.lines.length - 1]!;
    const newPrevLastLine = new Line({ words: [...prevLastLine.words, word], structureTags: prevLastLine.structureTags, id: prevLastLine.id });
    const newPrevSeg = this._withLines(prev, [...prev.lines.slice(0, -1), newPrevLastLine]);

    const newFirstLineWords = firstLine.words.slice(1);
    const newSlots: SegmentSlot[] = [...slots];
    newSlots[segIdx - 1] = { segment: newPrevSeg, section: slots[segIdx - 1]!.section };
    if (newFirstLineWords.length === 0) {
      const remaining = current.lines.slice(1);
      if (remaining.length === 0) {
        newSlots.splice(segIdx, 1);
      } else {
        newSlots[segIdx] = { segment: this._withLines(current, remaining), section: slots[segIdx]!.section };
      }
    } else {
      const newCurrent = this._withLines(current, [
        new Line({ words: newFirstLineWords, structureTags: firstLine.structureTags, id: firstLine.id }),
        ...current.lines.slice(1),
      ]);
      newSlots[segIdx] = { segment: newCurrent, section: slots[segIdx]!.section };
    }
    return this._rebuild(newSlots, doc);
  }

  moveLastWordToNextSegment(doc: Document, segIdx: number): Document {
    const slots = this._flatten(doc);
    if (segIdx < 0 || segIdx >= slots.length - 1) return doc;
    const current = slots[segIdx]!.segment;
    const next = slots[segIdx + 1]!.segment;
    const lastLine = current.lines[current.lines.length - 1]!;
    const word = lastLine.words[lastLine.words.length - 1]!;

    const nextFirstLine = next.lines[0]!;
    const newNextFirstLine = new Line({ words: [word, ...nextFirstLine.words], structureTags: nextFirstLine.structureTags, id: nextFirstLine.id });
    const newNextSeg = this._withLines(next, [newNextFirstLine, ...next.lines.slice(1)]);

    const newLastLineWords = lastLine.words.slice(0, -1);
    const newSlots: SegmentSlot[] = [...slots];
    newSlots[segIdx + 1] = { segment: newNextSeg, section: slots[segIdx + 1]!.section };
    if (newLastLineWords.length === 0) {
      const remaining = current.lines.slice(0, -1);
      if (remaining.length === 0) {
        newSlots.splice(segIdx, 1);
      } else {
        newSlots[segIdx] = { segment: this._withLines(current, remaining), section: slots[segIdx]!.section };
      }
    } else {
      const newCurrent = this._withLines(current, [
        ...current.lines.slice(0, -1),
        new Line({ words: newLastLineWords, structureTags: lastLine.structureTags, id: lastLine.id }),
      ]);
      newSlots[segIdx] = { segment: newCurrent, section: slots[segIdx]!.section };
    }
    return this._rebuild(newSlots, doc);
  }

  moveLineToSegment(doc: Document, fromSegIdx: number, fromLineIdx: number, toSegIdx: number, toLineIdx: number): Document {
    const slots = this._flatten(doc);
    if (fromSegIdx >= slots.length || toSegIdx >= slots.length) return doc;
    const fromSeg = slots[fromSegIdx]!.segment;
    const toSeg = slots[toSegIdx]!.segment;
    const line = fromSeg.lines[fromLineIdx]!;

    const newFromLines = [...fromSeg.lines.slice(0, fromLineIdx), ...fromSeg.lines.slice(fromLineIdx + 1)];
    const newToLines = [...toSeg.lines.slice(0, toLineIdx), line, ...toSeg.lines.slice(toLineIdx)];
    const newToSeg = this._withLines(toSeg, newToLines);

    const newSlots: SegmentSlot[] = [...slots];
    newSlots[toSegIdx] = { segment: newToSeg, section: slots[toSegIdx]!.section };
    if (newFromLines.length === 0) {
      newSlots.splice(fromSegIdx, 1);
    } else {
      newSlots[fromSegIdx] = { segment: this._withLines(fromSeg, newFromLines), section: slots[fromSegIdx]!.section };
    }
    return this._rebuild(newSlots, doc);
  }

  /**
   * Replaces the entire content of a segment with words derived from
   * `rawText`. `\n` separates lines, whitespace runs separate words.
   * The segment's start/end time is preserved verbatim — durations are
   * redistributed across the new words by character length, and the last
   * word ends exactly at the segment's end (clamped to absorb rounding).
   *
   * Edge cases:
   *  - Empty input (no actual words) → keeps the segment alive with a
   *    single empty Word holding the full segment time. The segment
   *    renders nothing but its time slot persists.
   *  - All structureTags (segment, line, word) are dropped: simple-view
   *    text edits don't carry any of the splitter's structure metadata,
   *    and the surrounding action will lock auto-layout anyway.
   *  - All ids are regenerated. wordStyleOverrides for words in this
   *    segment go stale (no longer reachable by id) — accepted by design
   *    for the simple/mobile view.
   */
  replaceSegmentText(doc: Document, segIdx: number, rawText: string): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;

    const segmentTime = slot.segment.time;
    const segmentId = slot.segment.id;

    // Parse into non-empty lines of non-empty words.
    const parsedLines: string[][] = [];
    let totalChars = 0;
    for (const rawLine of rawText.split('\n')) {
      const words = rawLine.trim().split(/\s+/).filter((w) => w.length > 0);
      if (words.length > 0) {
        parsedLines.push(words);
        for (const w of words) totalChars += w.length;
      }
    }

    if (parsedLines.length === 0) {
      const emptyWord = new Word({ text: '', time: segmentTime });
      const emptyLine = new Line({ words: [emptyWord] });
      const emptySegment = new Segment({ lines: [emptyLine], id: segmentId });
      return this._replaceSegmentSlot(doc, slots, segIdx, emptySegment);
    }

    const totalDuration = segmentTime.end - segmentTime.start;
    const totalWords = parsedLines.reduce((sum, line) => sum + line.length, 0);
    let cursor = segmentTime.start;
    let wordsSeen = 0;

    const newLines: Line[] = parsedLines.map((words) => {
      const newWords = words.map((text) => {
        wordsSeen++;
        const isLast = wordsSeen === totalWords;
        const duration = totalChars === 0 ? 0 : totalDuration * (text.length / totalChars);
        const start = cursor;
        const end = isLast ? segmentTime.end : cursor + duration;
        cursor = end;
        return new Word({ text, time: new TimeFragment(start, end) });
      });
      return new Line({ words: newWords });
    });

    const newSegment = new Segment({ lines: newLines, id: segmentId });
    return this._replaceSegmentSlot(doc, slots, segIdx, newSegment);
  }

  deleteSegment(doc: Document, segIdx: number): Document {
    const slots = this._flatten(doc);
    if (segIdx < 0 || segIdx >= slots.length) return doc;
    const newSlots = [...slots.slice(0, segIdx), ...slots.slice(segIdx + 1)];
    return this._rebuild(newSlots, doc);
  }

  /**
   * Replaces every Section whose `kind === fromKind` with a copy whose
   * `kind === toKind`, then collapses adjacent same-kind Sections. The
   * resulting Document carries fewer (or equal) Sections; segment order
   * is preserved.
   */
  remapKind(doc: Document, fromKind: string, toKind: string): Document {
    if (fromKind === toKind) return doc;
    const remapped = doc.sections.map((s) => (s.kind === fromKind ? s.with({ kind: toKind }) : s));
    return this._mergeAdjacent(remapped, doc);
  }

  private _mergeAdjacent(sections: ReadonlyArray<Section>, doc: Document): Document {
    const result: Section[] = [];
    for (const sec of sections) {
      const last = result[result.length - 1];
      if (last && last.kind === sec.kind) {
        result[result.length - 1] = last.with({ segments: [...last.segments, ...sec.segments] });
      } else {
        result.push(sec);
      }
    }
    return new Document({ sections: result, narrationPace: doc.narrationPace });
  }

  /**
   * Replaces a single segment with a list of new segments, all lifted into
   * a fresh Section with the given `kind`. Slots in the original Section
   * after the target are reparented to a clone of the original Section
   * (with a new id) so id-uniqueness holds when `_rebuild` reassembles
   * and applies the adjacent-same-kind merge invariant.
   */
  replaceSegmentWithKind(
    doc: Document,
    segmentId: string,
    newSegments: ReadonlyArray<Segment>,
    newKind: string,
  ): Document {
    const slots = this._flatten(doc);
    const slotIdx = slots.findIndex((s) => s.segment.id === segmentId);
    if (slotIdx < 0) return doc;
    if (newSegments.length === 0) return doc;

    const target = slots[slotIdx]!;
    const originalSection = target.section;
    const lifted = new Section({ segments: [], kind: newKind });
    const tail = new Section({ segments: [], kind: originalSection.kind, structureTags: originalSection.structureTags });

    let pastTarget = false;
    const newSlots: SegmentSlot[] = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      if (i === slotIdx) {
        pastTarget = true;
        for (const seg of newSegments) {
          newSlots.push({ segment: seg, section: lifted });
        }
        continue;
      }
      if (pastTarget && slot.section === originalSection) {
        newSlots.push({ segment: slot.segment, section: tail });
      } else {
        newSlots.push(slot);
      }
    }
    return this._rebuild(newSlots, doc);
  }

  private _replaceWords(doc: Document, segIdx: number, lineIdx: number, wordIdx: number, newWords: Word[]): Document {
    const line = doc.getSegments()[segIdx]!.lines[lineIdx]!;
    return this._replaceLine(doc, segIdx, lineIdx, new Line({
      words: [
        ...line.words.slice(0, wordIdx),
        ...newWords,
        ...line.words.slice(wordIdx + 1),
      ],
      structureTags: line.structureTags,
      id: line.id,
    }));
  }

  private _replaceLine(doc: Document, segIdx: number, lineIdx: number, newLine: Line): Document {
    const slots = this._flatten(doc);
    const slot = slots[segIdx];
    if (!slot) return doc;
    const segment = slot.segment;
    return this._replaceSegmentSlot(doc, slots, segIdx, this._withLines(segment, [
      ...segment.lines.slice(0, lineIdx),
      newLine,
      ...segment.lines.slice(lineIdx + 1),
    ]));
  }

  /**
   * Rebuilds a segment with a new set of lines and clears any `customTime`
   * the segment was carrying. `customTime` overrides the segment's time
   * window with a value chosen against the previous word composition;
   * once the words change that value no longer reflects the segment's
   * actual range, so it falls back to the natural, word-derived time.
   */
  private _withLines(segment: Segment, lines: ReadonlyArray<Line>): Segment {
    return segment.with({ lines, customTime: null });
  }

  private _replaceSegmentSlot(doc: Document, slots: SegmentSlot[], segIdx: number, newSegment: Segment): Document {
    const newSlots = [...slots];
    newSlots[segIdx] = { segment: newSegment, section: slots[segIdx]!.section };
    return this._rebuild(newSlots, doc);
  }

  private _flatten(doc: Document): SegmentSlot[] {
    const result: SegmentSlot[] = [];
    for (const section of doc.sections) {
      for (const segment of section.segments) {
        result.push({ segment, section });
      }
    }
    return result;
  }

  /**
   * Reassembles slots into Sections in two passes:
   *   1. Group consecutive same-Section slots, preserving each Section's
   *      id + structureTags.
   *   2. Apply the merge invariant: adjacent Sections sharing a `kind`
   *      collapse into a single Section (the first one's identity wins).
   *
   * Sections whose every segment was removed are dropped.
   */
  private _rebuild(slots: SegmentSlot[], doc: Document): Document {
    if (slots.length === 0) return new Document({ sections: [], narrationPace: doc.narrationPace });

    type Group = { section: Section; segments: Segment[] };
    const grouped: Group[] = [];
    let acc: Group | null = null;
    for (const slot of slots) {
      if (acc && acc.section === slot.section) {
        acc.segments.push(slot.segment);
      } else {
        if (acc) grouped.push(acc);
        acc = { section: slot.section, segments: [slot.segment] };
      }
    }
    if (acc) grouped.push(acc);

    let i = 0;
    while (i < grouped.length - 1) {
      const cur = grouped[i]!;
      const next = grouped[i + 1]!;
      if (cur.section.kind === next.section.kind) {
        cur.segments.push(...next.segments);
        grouped.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    return new Document({
      sections: grouped.map((g) => g.section.with({ segments: g.segments })),
      narrationPace: doc.narrationPace,
    });
  }
}
