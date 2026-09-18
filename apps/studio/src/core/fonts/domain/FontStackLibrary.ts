import { FontStack } from '@core/fonts/domain/FontStack';
import type { CatalogFontStack } from '@core/fonts/domain/FontStackCatalog';
import { DEFAULT_FONT_STACK_ID, FONT_STACKS } from '@core/fonts/domain/FontStackCatalog';

/**
 * The stacks the catalog ships, by the id a template names.
 *
 * An id nothing answers to resolves to the default stack rather than to
 * nothing: a template naming a stack this build retired still has to
 * render, and captions in a designed face beat captions in whatever the
 * device supplies.
 */
export class FontStackLibrary {
  private readonly byId: ReadonlyMap<string, CatalogFontStack>;

  constructor(private readonly stacks: ReadonlyArray<CatalogFontStack> = FONT_STACKS) {
    this.byId = new Map(stacks.map((stack) => [stack.id, stack]));
  }

  stackFor(id: string): FontStack {
    return FontStack.of(this.entryFor(id).faces);
  }

  /**
   * The stack whose Latin face is `family`, or the default stack with
   * `family` put in its Latin seat when the catalog knows none — which
   * is what a font the reader uploaded answers to.
   */
  stackLedBy(family: string): FontStack {
    const found = this.stacks.find((stack) => stack.faces.latin === family);
    if (found !== undefined) return FontStack.of(found.faces);
    return this.stackFor(DEFAULT_FONT_STACK_ID).with('latin', family);
  }

  /** Whether this build ships a stack under that id. */
  knows(id: string): boolean {
    return this.byId.has(id);
  }

  private entryFor(id: string): CatalogFontStack {
    const found = this.byId.get(id) ?? this.byId.get(DEFAULT_FONT_STACK_ID);
    if (found === undefined) throw new Error(`Font stack catalog ships no '${DEFAULT_FONT_STACK_ID}' stack`);
    return found;
  }
}
