/** Names a composite family from its ordered script-to-face assignments. */
export class CompiledFamilyNamer {

  nameFor(families: ReadonlyArray<string>): string {
    return `tscaps-${this.slug(families[0] ?? 'font')}-${this.fingerprint(families)}`;
  }

  private slug(family: string): string {
    return family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'font';
  }

  private fingerprint(families: ReadonlyArray<string>): string {
    let hash = 5381;
    for (const character of families.join('\u0000')) {
      hash = (hash * 33) ^ character.codePointAt(0)!;
    }
    return (hash >>> 0).toString(36);
  }
}
