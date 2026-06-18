import type { ControlValue } from '@core/templates/domain/definition/ControlField';

/**
 * Named style preset a template ships. Each variant is a partial map of
 * `styleControl.id -> value` applied on top of the template defaults to
 * produce a sheet's effective styling. A template that ships two or more
 * variants lets a sheet pick which preset it follows; templates with no
 * variants behave as a single fixed preset.
 *
 * Variants are template-defined, not user-defined: the author chooses
 * the labels and the values. The user picks among them through the
 * style tab and the multi-speaker flow assigns a different variant to
 * each speaker sheet automatically.
 */
export interface StyleVariant {
  readonly label: string;
  readonly overrides: Readonly<Record<string, ControlValue>>;
}

export type StyleVariants = ReadonlyArray<StyleVariant>;
