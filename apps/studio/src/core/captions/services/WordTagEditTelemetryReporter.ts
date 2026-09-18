import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export type WordTagEditSource = 'word' | 'selection';

export interface WordTagEdit {
  readonly tagName: string;
  readonly enabled: boolean;
  readonly source: WordTagEditSource;
  /** How many words the edit landed on. */
  readonly wordCount: number;
}

/**
 * Reports the first few word tag edits of a page load, and stays
 * silent after.
 *
 * The question worth answering is whether anyone reaches for tags by
 * hand at all, and which ones. A visitor who works through a whole
 * transcript answers that in the first handful; the rest of the run
 * would only weigh the same answer more heavily than a visitor who
 * tagged one word, which is the opposite of what the number is read
 * for. The window is the page load, not the project.
 */
export class WordTagEditTelemetryReporter {

  private static readonly REPORT_LIMIT = 5;

  private reported = 0;

  constructor(private readonly telemetry: Telemetry) {}

  report(edit: WordTagEdit): void {
    if (this.reported >= WordTagEditTelemetryReporter.REPORT_LIMIT) return;
    this.reported++;
    this.telemetry.capture('word_tag_edited', {
      tag: edit.tagName,
      enabled: edit.enabled,
      source: edit.source,
      word_count: edit.wordCount,
    });
  }
}
