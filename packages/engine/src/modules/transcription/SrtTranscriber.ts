import { Document } from '@modules/document/Document';
import { Section } from '@modules/document/Section';
import { Segment } from '@modules/document/Segment';
import { Line } from '@modules/document/Line';
import { Word } from '@modules/document/Word';
import { TimeFragment } from '@modules/document/TimeFragment';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

const SRT_TIMECODE_RE =
  /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;
const FORMATTING_TAG_RE = /<[^>]+>|\{[^}]+\}/g;
const BOM_RE = /^\uFEFF/;

interface ParsedCue {
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly text: string;
}

/**
 * Builds a Document by parsing a SubRip (SRT) caption file. Each cue
 * becomes one `Segment` carrying the cue's full time range; the cue's
 * text (multi-line entries joined with a space, formatting tags
 * stripped) becomes one `Line` whose `Word` timings are spread across
 * the cue range proportionally to character length, so each word
 * lights up in sequence rather than all at once.
 *
 * The audio Blob passed to `transcribe` is ignored. Useful when the
 * caption text and timing are already known — burning a hand-authored
 * SRT into a video, replaying captions from a previous run, etc.
 *
 * Throws when a timecode is malformed; returns an empty Document when
 * the source contains no parseable cues.
 */
export class SrtTranscriber implements Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;

  constructor(private readonly source: string) {}

  async transcribe(_audio: Blob, _options?: TranscriberOptions): Promise<Document> {
    this.onProgress?.({ stage: 'inferring', progress: 1 });
    return this.buildDocumentFromSource(this.source);
  }

  private buildDocumentFromSource(source: string): Document {
    const segments = this.parseCues(source).map((cue) => this.buildSegmentFromCue(cue));
    const section = new Section({ segments, kind: '' });
    return new Document({ sections: [section] });
  }

  private parseCues(source: string): ParsedCue[] {
    const normalized = source.replace(BOM_RE, '').replace(/\r\n?/g, '\n').trim();
    if (normalized.length === 0) return [];
    return normalized
      .split(/\n{2,}/)
      .map((block) => this.parseCueBlock(block))
      .filter((cue): cue is ParsedCue => cue !== null);
  }

  private parseCueBlock(block: string): ParsedCue | null {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    const timecodeLineIndex = this.findTimecodeLineIndex(lines);
    if (timecodeLineIndex === -1) {
      throw new Error(`SRT block has no timecode line: ${JSON.stringify(block)}`);
    }
    const range = this.parseTimecodeLine(lines[timecodeLineIndex]!);
    const text = this.normalizeCueText(lines.slice(timecodeLineIndex + 1));
    if (text.length === 0) return null;
    return { startSeconds: range.startSeconds, endSeconds: range.endSeconds, text };
  }

  private findTimecodeLineIndex(lines: ReadonlyArray<string>): number {
    return lines.findIndex((line) => SRT_TIMECODE_RE.test(line));
  }

  private parseTimecodeLine(line: string): { startSeconds: number; endSeconds: number } {
    const match = SRT_TIMECODE_RE.exec(line);
    if (match === null) throw new Error(`Malformed SRT timecode: ${JSON.stringify(line)}`);
    const startSeconds = this.toSeconds(match[1]!, match[2]!, match[3]!, match[4]!);
    const endSeconds = this.toSeconds(match[5]!, match[6]!, match[7]!, match[8]!);
    if (endSeconds < startSeconds) {
      throw new Error(`SRT timecode ends before it starts: ${JSON.stringify(line)}`);
    }
    return { startSeconds, endSeconds };
  }

  private toSeconds(hours: string, minutes: string, seconds: string, milliseconds: string): number {
    return (
      Number(hours) * 3600 +
      Number(minutes) * 60 +
      Number(seconds) +
      Number(milliseconds.padEnd(3, '0')) / 1000
    );
  }

  private normalizeCueText(textLines: ReadonlyArray<string>): string {
    return textLines.join(' ').replace(FORMATTING_TAG_RE, '').replace(/\s+/g, ' ').trim();
  }

  private buildSegmentFromCue(cue: ParsedCue): Segment {
    const tokens = cue.text.split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) {
      return new Segment({ lines: [new Line({ words: [] })] });
    }
    const words = this.distributeWordsAcrossCueRange(tokens, cue.startSeconds, cue.endSeconds);
    return new Segment({ lines: [new Line({ words })] });
  }

  private distributeWordsAcrossCueRange(
    tokens: ReadonlyArray<string>,
    startSeconds: number,
    endSeconds: number,
  ): Word[] {
    const totalWeight = tokens.reduce((sum, token) => sum + token.length, 0);
    const cueDuration = endSeconds - startSeconds;
    if (totalWeight === 0 || cueDuration <= 0) {
      return tokens.map((token) => new Word({ text: token, time: new TimeFragment(startSeconds, endSeconds) }));
    }
    const words: Word[] = [];
    let elapsedWeight = 0;
    for (const token of tokens) {
      const wordStart = startSeconds + (elapsedWeight / totalWeight) * cueDuration;
      elapsedWeight += token.length;
      const wordEnd = startSeconds + (elapsedWeight / totalWeight) * cueDuration;
      words.push(new Word({ text: token, time: new TimeFragment(wordStart, wordEnd) }));
    }
    return words;
  }
}
