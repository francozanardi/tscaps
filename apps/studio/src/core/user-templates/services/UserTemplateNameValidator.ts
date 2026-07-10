/**
 * Validates a user-template display name. The name is rendered letter
 * by letter inside the editor preview (a single-word visual treatment)
 * and persisted as the entity's `template.metadata.name`, so it stays
 * a short slug-like token: ASCII alphanumerics with optional `-` /
 * `_`, no spaces, no symbols, no leading separator.
 */
export class UserTemplateNameValidator {

  private static readonly MAX_LENGTH = 24;
  private static readonly PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

  /** Maximum character count an accepted name may have. */
  get maxLength(): number {
    return UserTemplateNameValidator.MAX_LENGTH;
  }

  /**
   * Returns a user-facing error message when `raw` cannot be persisted
   * as a user-template name, or `null` when it can. Does not trim — the
   * caller decides whether trailing whitespace is a typo (trim first)
   * or a hard error (validate as-is).
   */
  validate(raw: string): string | null {
    if (raw.length === 0) return 'Name is required.';
    if (raw.length > UserTemplateNameValidator.MAX_LENGTH) {
      return `Name must be at most ${UserTemplateNameValidator.MAX_LENGTH} characters.`;
    }
    if (!UserTemplateNameValidator.PATTERN.test(raw)) {
      return 'Use letters, numbers, "-" or "_" only. No spaces. Must start with a letter or number.';
    }
    return null;
  }
}
