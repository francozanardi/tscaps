import type { OperationResult } from '@core/editor-operations/domain/OperationResult';

/** Whether an operation only reads the project or can change it. */
export type EditorOperationEffect = 'read' | 'edit';

/**
 * One thing a program can ask the open editor to read or to change,
 * through the same actions the editor's own panels call: the typed
 * surface a client other than a person uses (an assistant, a script, a
 * test).
 *
 * `name` is snake_case and stable: once shipped it is never renamed.
 * `description` and `inputSchema` (a JSON Schema of an object) are all a
 * caller sees, so they say what the operation does, when to use it, and
 * every unit and range. Elements are named by refs, `kind:id` text.
 *
 * Every change an operation makes is one the person can undo.
 */
export interface EditorOperation {
  readonly name: string;
  readonly description: string;
  readonly effect: EditorOperationEffect;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /**
   * Runs on the project as it is now. An input that does not follow the
   * schema, or names something that is not there, answers `ok: false`
   * with problems and changes nothing; it never throws for that. Rejects
   * only on a failure no input could have avoided.
   */
  run(input: unknown): Promise<OperationResult>;
}
