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
  'peak',
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
  /** Whether a word can be checked into this tag by hand. */
  readonly offeredOnWords: boolean;
}

/**
 * Presentation metadata for the tags the user ever reads a name for.
 * A tag's presence here is what flags it as user-facing; tags absent
 * from this map are platform-internal, emitted by a tagger and
 * consumed by a specific feature (e.g. `cut` is consumed by the auto
 * remove-bad-takes flow) and never named on screen. Being user-facing
 * says the tag has a label, not that a word can be checked into it:
 * `offeredOnWords` is what answers that. `satisfies` keeps every key
 * constrained to the canonical vocabulary while leaving the literal
 * type intact so `UserFacingTagName` reads as a narrow subset of
 * `TagName`.
 */
export const TAG_METADATA = {
  number: {
    label: 'Number',
    description: 'A purely numeric word: an integer or a decimal, like 2024, 1.5, or 1,000.',
    offeredOnWords: true,
  },
  quote: {
    label: 'Quote',
    description: 'A word that sits inside quotation marks, marking a direct citation or a highlighted phrase.',
    offeredOnWords: true,
  },
  emphasis: {
    label: 'Emphasis',
    description: 'The punch word of a sentence: a key noun, strong verb, or vivid adjective worth lifting. Roughly one per sentence.',
    offeredOnWords: true,
  },
  // Named for what the word does rather than "accent", which templates
  // use for the whole family of lifted words their style controls reach.
  accent: {
    label: 'Lift',
    description: 'Short supporting lifts sprinkled through each sentence to give captions rhythm. Two to four per sentence.',
    offeredOnWords: true,
  },
  peak: {
    label: 'Peak',
    description: 'A high point of the video: a closed phrase carrying the message, the line a viewer would screenshot. At most three per video, and many have none.',
    offeredOnWords: false,
  },
  hook: {
    label: 'Hook',
    description: 'The opening line, when it is built to stop a viewer from scrolling. At most one per video.',
    offeredOnWords: false,
  },
  entity: {
    label: 'Entity',
    description: 'A proper noun: the specific name of a person, place, brand, product, or organization.',
    offeredOnWords: true,
  },
  cta: {
    label: 'Call to action',
    description: 'The speaker asking the viewer to do something: subscribe, follow, click, visit a link.',
    offeredOnWords: false,
  },
  superlative: {
    label: 'Superlative',
    description: 'A claim of an absolute: the most, the only, the first, the never, the always.',
    offeredOnWords: false,
  },
  stat: {
    label: 'Stat',
    description: 'A number that carries an argumentative claim: percentage, multiplier, amount, count, or duration.',
    offeredOnWords: false,
  },
} as const satisfies Readonly<Partial<Record<TagName, TagNameMetadata>>>;

export type UserFacingTagName = keyof typeof TAG_METADATA;

/**
 * The tags a word can be checked into by hand, in the order they are
 * offered. Two kinds are left out: the ones describing a stretch of
 * speech rather than a word, whose surface is the sheet a scene is
 * assigned to, and the ones no tagger emits and no template paints.
 * Both stay user-facing, which is what keeps the first kind behind the
 * role sheets.
 *
 * A tag reaching a word by any other route, a tagger or a loaded
 * project, is not constrained by this list.
 */
export const WORD_TAG_NAMES: readonly UserFacingTagName[] =
  (Object.keys(TAG_METADATA) as UserFacingTagName[])
    .filter((name) => TAG_METADATA[name].offeredOnWords);
