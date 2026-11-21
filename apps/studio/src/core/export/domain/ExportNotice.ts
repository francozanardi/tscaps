import type { AudioMixDropReason, OutputFormat } from '@tscaps/engine';

/**
 * Outcome message surfaced to the user when an export finishes
 * successfully but with something noteworthy to acknowledge (e.g. a
 * dropped audio track). Cleared once the user dismisses it. Tagged
 * union so new notice kinds can be added without touching consumers.
 * `format` is the file format the export was written in.
 *
 * `audio-mix-dropped`: the soundtrack's sounds were left out, and the
 * video's own sound written as it would be without them.
 */
export type ExportNotice =
  | {
      readonly kind: 'audio-discarded';
      readonly reason: 'unknown-source-codec' | 'no-encodable-target-codec';
      readonly format: OutputFormat;
    }
  | {
      readonly kind: 'audio-mix-dropped';
      readonly reason: AudioMixDropReason;
      readonly format: OutputFormat;
    };
