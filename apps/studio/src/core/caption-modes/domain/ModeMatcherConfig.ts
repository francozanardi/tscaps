/**
 * How a template says which words go into one of its modes. Only `type`
 * is required; each kind of matcher extends it with its parameters, and
 * a template may list several, a word joining the mode when any of them
 * picks it.
 */
export interface ModeMatcherConfig {
  readonly type: string;
}

/** The words whose semantic tags satisfy a tag expression (`"hook or peak"`). */
export interface TagConditionModeMatcherConfig extends ModeMatcherConfig {
  readonly type: 'tag-condition';
  readonly condition: string;
}
