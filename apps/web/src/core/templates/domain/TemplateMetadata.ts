export interface TemplateMetadata {
  id: string;
  name: string;
  /** Free-form tags. The picker derives category tabs from the union. */
  categories: readonly string[];
  /**
   * Case-insensitive substrings matched against `navigator.userAgent`. A
   * non-empty intersection marks the template as unrenderable in the current
   * environment.
   */
  unsupportedUserAgents: readonly string[];
}
