import type { Document } from '@modules/document/Document';
import { SrtTranscriber } from '@modules/transcription/SrtTranscriber';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

const BOM_RE = /^\uFEFF/;

/**
 * Builds a Document by parsing a WebVTT (`.vtt`) caption file. Skips
 * the mandatory `WEBVTT` header block and any `NOTE`, `STYLE`, or
 * `REGION` blocks, then hands the remaining cue blocks to
 * `SrtTranscriber` — the underlying timecode grammar, tag stripping,
 * and word-timing distribution are compatible between the two
 * formats.
 *
 * The audio Blob passed to `transcribe` is ignored. Useful when
 * caption text and timing are already known — burning a hand-authored
 * VTT into a video, replaying captions from a subtitle-authoring
 * tool, etc.
 *
 * Throws when a cue block is malformed; returns an empty Document
 * when the source has no parseable cues.
 */
export class VttTranscriber implements Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;

  constructor(private readonly source: string) {}

  async transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document> {
    const cueOnlySource = this.extractCueBlocks(this.source);
    const inner = new SrtTranscriber(cueOnlySource);
    if (this.onProgress) inner.onProgress = this.onProgress;
    return inner.transcribe(audio, options);
  }

  private extractCueBlocks(source: string): string {
    const normalized = source.replace(BOM_RE, '').replace(/\r\n?/g, '\n');
    const withoutHeader = this.stripWebVttHeader(normalized);
    return withoutHeader
      .split(/\n{2,}/)
      .filter((block) => this.isCueBlock(block))
      .join('\n\n');
  }

  private stripWebVttHeader(source: string): string {
    if (!/^WEBVTT(?:\s|$)/.test(source)) return source;
    const firstBlockEnd = source.indexOf('\n\n');
    if (firstBlockEnd === -1) return '';
    return source.slice(firstBlockEnd + 2);
  }

  private isCueBlock(block: string): boolean {
    const firstLine = block.trim().split('\n')[0]?.trim() ?? '';
    if (firstLine.length === 0) return false;
    if (firstLine === 'STYLE' || firstLine === 'REGION') return false;
    if (firstLine === 'NOTE' || firstLine.startsWith('NOTE ') || firstLine.startsWith('NOTE\t')) return false;
    return true;
  }
}
