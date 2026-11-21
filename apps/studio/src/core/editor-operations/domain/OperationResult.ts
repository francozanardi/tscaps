/**
 * Something wrong with what an operation was asked, or with what it
 * wrote: a missing element, a value out of range, CSS the editor will not
 * draw. `error` means nothing was changed for it; `warning` means the
 * change was made and may not do what was meant. `ref` names the element
 * it is about, as `kind:id`.
 */
export interface OperationProblem {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly ref?: string;
}

/**
 * What an operation answered. `ok` is false when it changed nothing
 * because of an error problem. `output` is a small JSON value: what was
 * read, or what was changed and the refs it created.
 */
export interface OperationResult {
  readonly ok: boolean;
  readonly output: unknown;
  readonly problems: ReadonlyArray<OperationProblem>;
}
