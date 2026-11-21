/**
 * Something a plan reads that the editor's state does not hold, such as
 * a measurement kept in a cache of its own. `current` takes a new
 * identity whenever it changes, so whoever keeps a plan's render open
 * can tell when the plan it was made from is out of date.
 */
export interface ExportRenderOutsideInput {
  readonly current: unknown;
}
