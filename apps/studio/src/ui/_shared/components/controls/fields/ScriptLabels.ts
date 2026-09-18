import type { FontFaceSlot } from '@core/fonts/domain/FontScript';

interface ScriptLabel {
  /** Accessible name, for a reader who cannot see the sample. */
  readonly name: string;
  /** A few letters of the script itself. */
  readonly sample: string;
}

/**
 * Every writing system a font choice can be made for.
 *
 * The name identifies the choice; the sample is a preview, and only
 * carries where it is drawn in the face being offered. Two scripts share
 * an alphabet — `أبجد` and `ابجد` are Arabic and Urdu — so the letters
 * alone cannot say which row a reader is looking at.
 */
export const SCRIPT_LABELS: Readonly<Record<FontFaceSlot, ScriptLabel>> = {
  latin: { name: 'Latin', sample: 'Abcd' },
  arabic: { name: 'Arabic', sample: 'أبجد' },
  hebrew: { name: 'Hebrew', sample: 'אבגד' },
  urdu: { name: 'Urdu', sample: 'ابجد' },
  cyrillic: { name: 'Cyrillic', sample: 'Абвг' },
  greek: { name: 'Greek', sample: 'Αβγδ' },
  devanagari: { name: 'Devanagari', sample: 'अआइई' },
  bengali: { name: 'Bengali', sample: 'অআইঈ' },
  telugu: { name: 'Telugu', sample: 'అఆఇఈ' },
  tamil: { name: 'Tamil', sample: 'அஆஇஈ' },
  thai: { name: 'Thai', sample: 'กขคง' },
  other: { name: 'Other', sample: '' },
};
