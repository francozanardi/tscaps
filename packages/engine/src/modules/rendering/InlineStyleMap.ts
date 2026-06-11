/**
 * One CSS declaration block as a map: keys are either property names
 * (`color`, `transform`) or custom-property names (`--tscaps-foo`); values
 * are valid CSS values for that property/var. The renderer concatenates
 * each entry into the target element's `style="..."` attribute as-is, so
 * vars and regular properties coexist transparently.
 */
export type InlineStyleMap = Readonly<Record<string, string>>;
