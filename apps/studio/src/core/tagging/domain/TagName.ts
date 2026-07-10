/**
 * Canonical platform vocabulary of semantic tag names. Every tagger
 * emits names from this set; templates style any subset of it via
 * `.word.<name>` CSS rules. The list grows as the platform adds
 * taggers, and future user-defined custom tag names will live
 * alongside these once the editor exposes a creation surface.
 */
export const TAG_NAMES = [
  'number',
  'quote',
  'emphasis',
  'accent',
  'highlight',
  'hook',
  'entity',
  'cta',
  'superlative',
  'stat',
  'cut',
] as const;

export type TagName = (typeof TAG_NAMES)[number];

export interface TagNameMetadata {
  /** Short user-facing label rendered next to the toggle. */
  readonly label: string;
  /** One or two sentence explanation surfaced behind a (?) tooltip. */
  readonly description: string;
}

/**
 * Presentation metadata for the tags the user can toggle on a word
 * from the tag editor. A tag's presence here is what flags it as
 * user-facing; tags absent from this map are platform-internal,
 * emitted by a tagger and consumed by a specific feature (e.g. `cut`
 * is consumed by the auto remove-bad-takes flow) but never offered
 * as a manual checkbox. `satisfies` keeps every key constrained to
 * the canonical vocabulary while leaving the literal type intact so
 * `UserFacingTagName` reads as a narrow subset of `TagName`.
 */
export const TAG_METADATA = {
  number: {
    label: 'Number',
    description: 'A purely numeric word: an integer or a decimal, like 2024, 1.5, or 1,000.',
  },
  quote: {
    label: 'Quote',
    description: 'A word that sits inside quotation marks, marking a direct citation or a highlighted phrase.',
  },
  emphasis: {
    label: 'Emphasis',
    description: 'The punch word of a sentence: a key noun, strong verb, or vivid adjective worth lifting. Roughly one per sentence.',
  },
  accent: {
    label: 'Accent',
    description: 'Short supporting lifts sprinkled through each sentence to give captions rhythm. Two to four per sentence.',
  },
  highlight: {
    label: 'Highlight',
    description: 'The thesis of the whole video, the line a viewer would screenshot. At most one or two per video.',
  },
  hook: {
    label: 'Hook',
    description: 'The opening line, when it is built to stop a viewer from scrolling. At most one per video.',
  },
  entity: {
    label: 'Entity',
    description: 'A proper noun: the specific name of a person, place, brand, product, or organization.',
  },
  cta: {
    label: 'Call to action',
    description: 'The speaker asking the viewer to do something: subscribe, follow, click, visit a link.',
  },
  superlative: {
    label: 'Superlative',
    description: 'A claim of an absolute: the most, the only, the first, the never, the always.',
  },
  stat: {
    label: 'Stat',
    description: 'A number that carries an argumentative claim: percentage, multiplier, amount, count, or duration.',
  },
} as const satisfies Readonly<Partial<Record<TagName, TagNameMetadata>>>;

export type UserFacingTagName = keyof typeof TAG_METADATA;
