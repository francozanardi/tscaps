import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { FontStackCssVariable } from '@core/fonts/domain/FontStackCssVariable';

/** Records one template's fixed font dependencies during Sass compilation, without declaring controls. */
export class TemplateFontStackRegistry {
  private readonly ids = new Set<string>();

  constructor(private readonly library: FontStackLibrary) {}

  /** Returns the variable name and records the dependency. Unknown IDs fail the build. */
  declare(id: string): string {
    if (!this.library.knows(id)) throw new Error(`Unknown font stack "${id}" in font-stack().`);
    this.ids.add(id);
    return FontStackCssVariable.nameFor(id);
  }

  declared(): readonly string[] {
    return [...this.ids];
  }
}
