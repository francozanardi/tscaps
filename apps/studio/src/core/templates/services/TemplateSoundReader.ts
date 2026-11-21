import type { TemplateSound } from '@core/templates/domain/definition/TemplateSound';

const MAX_OFFSET_SEC = 10;

/**
 * Reads a template's sounds from untrusted input: as an author writes
 * them in `template.json`, or as a saved template stores them. An entry
 * without a sound or an expression is dropped; a volume or an offset out
 * of range is brought into it, and an absent one takes its default (full
 * volume, no offset, no gap, any word). Whether the sound exists and the
 * expression parses is not checked here: a sound this build does not
 * carry plays nothing, and the template contract refuses both.
 */
export class TemplateSoundReader {
  /** The `sounds` field of a `template.json`. */
  readDeclared(value: unknown): TemplateSound[] {
    return this.entriesOf(value).flatMap((entry) => this.soundFrom(entry.when, entry.sound, entry.volume, entry.offset, entry.alone, entry.minGap));
  }

  /** The `sounds` field of a saved template. */
  readStored(value: unknown): TemplateSound[] {
    return this.entriesOf(value).flatMap((entry) => this.soundFrom(entry.when, entry.soundId, entry.volume, entry.offsetSec, entry.alone, entry.minGapSec));
  }

  private entriesOf(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null);
  }

  private soundFrom(when: unknown, soundId: unknown, volume: unknown, offsetSec: unknown, alone: unknown, minGapSec: unknown): TemplateSound[] {
    if (typeof when !== 'string' || when.trim() === '') return [];
    if (typeof soundId !== 'string' || soundId === '') return [];
    return [{
      when,
      soundId,
      volume: this.within(volume, 0, 1, 1),
      offsetSec: this.within(offsetSec, -MAX_OFFSET_SEC, MAX_OFFSET_SEC, 0),
      alone: alone === true,
      minGapSec: this.within(minGapSec, 0, MAX_OFFSET_SEC, 0),
    }];
  }

  private within(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
