import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';

/**
 * The operations a program can ask of the editor, by name. The order
 * they were given in is kept: a caller that offers them to a model in
 * that order offers the same list every time.
 */
export class EditorOperationCatalog {
  private readonly byName = new Map<string, EditorOperation>();

  /** Throws when two operations share a name: that is a wiring mistake, not an input. */
  constructor(private readonly operations: ReadonlyArray<EditorOperation>) {
    for (const operation of operations) {
      if (this.byName.has(operation.name)) throw new Error(`Two editor operations are named ${operation.name}`);
      this.byName.set(operation.name, operation);
    }
  }

  list(): ReadonlyArray<EditorOperation> {
    return this.operations;
  }

  find(name: string): EditorOperation | null {
    return this.byName.get(name) ?? null;
  }
}
