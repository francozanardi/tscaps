import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

/** What a ref named in the project as it is now: the thing, or the problem to answer with. */
export type ResolvedRef<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: OperationProblem };
