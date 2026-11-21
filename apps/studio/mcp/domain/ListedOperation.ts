/** An operation of the editor's catalog as the page lists it: what a program needs to offer it as a tool. */
export interface ListedOperation {
  readonly name: string;
  readonly description: string;
  readonly effect: 'read' | 'edit';
  /** A JSON Schema of an object. */
  readonly inputSchema: Readonly<Record<string, unknown>>;
}
