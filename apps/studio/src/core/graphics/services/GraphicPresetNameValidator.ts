const MAX_CHARS = 60;

/** What a graphic preset a user saves may be called: something, and at most 60 characters. */
export class GraphicPresetNameValidator {
  readonly maxLength = MAX_CHARS;

  /** Why `name` cannot be a preset's, for the user to read; null where it can. Spaces at either end do not count. */
  problemWith(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed === '') return 'Give the preset a name.';
    if (trimmed.length > MAX_CHARS) return `Keep the name under ${MAX_CHARS} characters.`;
    return null;
  }
}
