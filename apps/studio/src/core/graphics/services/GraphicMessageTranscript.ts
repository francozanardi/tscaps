import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';

// Enough to read what went wrong; few enough that code logging in a loop floods nothing.
const MAX_LINES = 200;
const MAX_CHARS = 20_000;
const MAX_LINE_CHARS = 2_000;

/**
 * What a graphic's code said during one play, in order and within
 * bounds: the first lines said, each cut short past a length, until a
 * number of lines or a total length is reached; past that, a last line
 * says how many more were said. One play's lines: a new play wants a new
 * transcript.
 */
export class GraphicMessageTranscript {
  private readonly lines: GraphicMessage[] = [];
  private keptChars = 0;
  private unkept = 0;

  record(message: GraphicMessage): void {
    if (this.lines.length >= MAX_LINES || this.keptChars >= MAX_CHARS) {
      this.unkept += 1;
      return;
    }
    // Typed as text, but it crossed from the graphic's frame, whose code may have sent anything.
    const said = String(message.text);
    const text = said.length > MAX_LINE_CHARS ? `${said.slice(0, MAX_LINE_CHARS)}… (cut short)` : said;
    this.lines.push({ level: message.level, text });
    this.keptChars += text.length;
  }

  /** The lines kept, oldest first, and a last one counting those that were not. */
  messages(): GraphicMessage[] {
    if (this.unkept === 0) return [...this.lines];
    return [...this.lines, { level: 'warn', text: `${this.unkept} more lines were said and not kept.` }];
  }
}
