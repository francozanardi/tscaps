import { Document } from '@modules/document/Document';
import { Line } from '@modules/document/Line';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import type { CueParseResult } from '@modules/transcription/CueParseResult';
import type { CueTimecodeReader } from '@modules/transcription/CueTimecodeReader';
import type { CueWordReader } from '@modules/transcription/CueWordReader';
import { SubtitleFileUnreadableError } from '@modules/transcription/SubtitleFileUnreadableError';

const BOM_RE = /^\uFEFF/;

/**
 * Builds a Document from the cue blocks of a caption file: blank lines
 * separate cues, a `-->` line states the range, and everything below it
 * is the text. Each cue becomes one Segment holding one Line, and every
 * word of it carries the cue's position among the cues kept (`cueIndex`),
 * so where one cue ended can still be told once the segments are cut
 * differently.
 *
 * A counter or identifier above the range line is ignored, since
 * neither says anything the Document keeps. A cue whose text is empty
 * is dropped. How the text becomes timed words is the reader's business
 * and the only thing that differs between formats.
 *
 * A block carrying no range line is skipped and handed back in the
 * result rather than ending the read. This is what the WebVTT parser
 * algorithm prescribes, and it is the only behaviour that serves
 * someone holding a file they did not write: one stray blank line
 * inside a cue, or one paragraph of prose at the end, would otherwise
 * cost them every cue in the file. Deciding whether the remainder is
 * worth using belongs to the caller, which is why the count of what
 * was lost travels with it.
 *
 * A file where every block was skipped is refused outright: what is
 * left is not a thin transcript, it is no transcript, and returning
 * one would say the file was silent rather than unreadable. A file
 * with no blocks at all is not refused — there is nothing in it to
 * misread.
 *
 * A malformed *timecode* still throws. That block announced its
 * intent to state a time and got it wrong, so placing its text
 * anywhere would be a guess.
 */
export class CueDocumentBuilder {
  constructor(private readonly timecodeReader: CueTimecodeReader) {}

  build(source: string, wordReader: CueWordReader): CueParseResult {
    const skippedBlocks: string[] = [];
    const segments: Segment[] = [];
    for (const block of this.splitIntoBlocks(source)) {
      const segment = this.buildSegment(block, wordReader, skippedBlocks, segments.length);
      if (segment !== null) segments.push(segment);
    }
    if (segments.length === 0 && skippedBlocks.length > 0) {
      throw new SubtitleFileUnreadableError(
        `None of the ${skippedBlocks.length} block(s) in the file carried a timecode line`,
      );
    }
    return {
      document: new Document({ sections: [new Section({ segments, kind: '' })] }),
      skippedBlocks,
    };
  }

  private splitIntoBlocks(source: string): ReadonlyArray<string> {
    const normalized = source.replace(BOM_RE, '').replace(/\r\n?/g, '\n').trim();
    if (normalized.length === 0) return [];
    return normalized.split(/\n{2,}/);
  }

  private buildSegment(
    block: string,
    wordReader: CueWordReader,
    skippedBlocks: string[],
    cueIndex: number,
  ): Segment | null {
    const lines = block.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    if (lines.length === 0) return null;
    const rangeAt = lines.findIndex((line) => this.timecodeReader.isRangeLine(line));
    if (rangeAt === -1) {
      skippedBlocks.push(block);
      return null;
    }
    const range = this.timecodeReader.readRange(lines[rangeAt]!);
    const text = lines.slice(rangeAt + 1).join(' ');
    const words = wordReader.read(text, range.startSeconds, range.endSeconds);
    if (words.length === 0) return null;
    return new Segment({ lines: [new Line({ words: words.map((word) => word.with({ cueIndex })) })] });
  }
}
