import type { CaptionScripts } from '@core/fonts/domain/CaptionScripts';
import { FontStackCssVariable } from '@core/fonts/domain/FontStackCssVariable';
import type { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import type { FontStackResolver } from '@core/fonts/services/FontStackResolver';

/** Binds fixed template font references to the same families used for editable stacks. */
export class FontStackCssVarsBuilder {

  constructor(
    private readonly library: FontStackLibrary,
    private readonly resolver: FontStackResolver,
  ) {}

  /** Null scripts select the ordinary fallback list used in gallery previews. */
  build(ids: readonly string[], scripts: CaptionScripts | null): Record<string, string> {
    return Object.fromEntries(ids.map((id) => [
      FontStackCssVariable.nameFor(id), this.resolver.resolve(this.library.stackFor(id), scripts),
    ]));
  }
}
