/** A template the assistant is pointed to first, and when it suits. */
export interface RecommendedTemplate {
  readonly id: string;
  readonly when: string;
}

/**
 * The templates offered first when the caption templates are listed, in
 * this order, each with when it suits and what it needs to look as meant.
 * Chosen by the owner (2026-11-05; margo added 2026-11-20), each `when` by the video's tone as the
 * direction guide reads it (2026-11-12); the rest of the catalog stays
 * available.
 */
export const RECOMMENDED_TEMPLATES: ReadonlyArray<RecommendedTemplate> = [
  { id: 'mira', when: 'Casual video, and any other tone when the captions should accompany the video rather than lead it; the one to keep when nothing else fits clearly better. Each speaker can take it in another colour.' },
  { id: 'enzo', when: 'Serious or professional: explainers, storytelling, advice, where a few words per sentence carry the point.' },
  { id: 'margo', when: 'Professional and warm: a personal story, a reflection, advice from experience or a voice-over, where the captions should read like a magazine rather than a feed.' },
  { id: 'nova', when: 'Serious, in a creator\'s voice: someone speaking with conviction to their audience (money, business, mindset, self-improvement), where each caption should land like a headline.' },
  { id: 'ezra', when: 'Professional or serious, when the video\'s statements should land as typography: one word per caption set large, as in a magazine.' },
  { id: 'yuki', when: 'Professional or serious, when the captions should only make the words readable, as in a documentary. Each speaker can take it in another colour.' },
  { id: 'loki', when: 'Viral and loud: entertainment, challenges, gaming, high-energy reactions.' },
  { id: 'miso', when: 'Viral and loud, like loki in a more modern look: entertainment, challenges, reactions. Its emojis show only where transcription suggested them; without suggestions, add them with set_emoji.' },
];
