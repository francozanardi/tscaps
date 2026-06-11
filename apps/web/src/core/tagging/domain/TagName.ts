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
] as const;

export type TagName = (typeof TAG_NAMES)[number];

export interface TagNameMetadata {
  /** Short user-facing label rendered next to the toggle. */
  readonly label: string;
  /** One or two sentence explanation surfaced behind a (?) tooltip. */
  readonly description: string;
}

/**
 * Presentation metadata per canonical tag. Lives next to the
 * vocabulary so adding a new `TagName` forces a label/description
 * decision at the type level. The UI reads from here; descriptions
 * stay agnostic of how any given template chooses to render the tag.
 */
export const TAG_METADATA: Readonly<Record<TagName, TagNameMetadata>> = {
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
};
