import type { Telemetry } from '@core/telemetry/domain/Telemetry';

export type CaptionsTextEditKind =
  | 'segment-text'
  | 'structure'
  | 'word-text'
  | 'word-inserted'
  | 'words-deleted';

/**
 * Reports that the visitor changed the caption text, once per page
 * load, tagged with whichever kind of edit came first.
 *
 * The actions behind it run on every keystroke and on every word-level
 * change, so an event each would cost a flood and say nothing a single
 * one does not. The question worth answering is whether someone worked
 * on the transcript at all: a visitor who typed and left is a
 * different story from one who never touched it, and a funnel cannot
 * tell them apart otherwise.
 *
 * The window is the page load, not the project. Opening a second
 * project in the same tab reports nothing further.
 */
export class CaptionsTextEditTelemetryReporter {

  private reported = false;

  constructor(private readonly telemetry: Telemetry) {}

  report(kind: CaptionsTextEditKind): void {
    if (this.reported) return;
    this.reported = true;
    this.telemetry.capture('captions_text_edited', { kind });
  }
}
