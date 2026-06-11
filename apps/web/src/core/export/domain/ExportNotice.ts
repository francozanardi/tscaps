/**
 * Outcome message surfaced to the user when an export finishes
 * successfully but with something noteworthy to acknowledge (e.g. a
 * dropped audio track). Cleared once the user dismisses it. Tagged
 * union so new notice kinds can be added without touching consumers.
 */
export type ExportNotice =
  | {
      readonly kind: 'audio-discarded';
      readonly reason: 'unknown-source-codec' | 'no-encodable-target-codec';
    };
