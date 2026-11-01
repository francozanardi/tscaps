/**
 * What a browser resolved for one element at rest, next to what it
 * resolved for the element it sits in.
 *
 * Computed values, read once and kept, so they stay readable after the
 * copy they were read from is gone. A property that was not read, or
 * that the browser left empty, reads as the empty string.
 */
export class RestingElementStyle {
  constructor(
    private readonly own: ReadonlyMap<string, string>,
    private readonly parent: ReadonlyMap<string, string>,
  ) {}

  /** The computed value of `property` on the element. */
  valueOf(property: string): string {
    return this.own.get(property) ?? '';
  }

  /** The computed value of `property` on the element it sits in. */
  parentValueOf(property: string): string {
    return this.parent.get(property) ?? '';
  }

  /** Whether `other` holds the same values, so a reading that changed nothing can keep its identity. */
  equals(other: RestingElementStyle | null): boolean {
    if (other === null) return false;
    return this.sameEntries(this.own, other.own) && this.sameEntries(this.parent, other.parent);
  }

  private sameEntries(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
    if (left.size !== right.size) return false;
    for (const [property, value] of left) {
      if (right.get(property) !== value) return false;
    }
    return true;
  }
}
