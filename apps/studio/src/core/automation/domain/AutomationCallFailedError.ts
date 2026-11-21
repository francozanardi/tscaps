/**
 * A call the page could not carry out: its params did not fit the
 * method, it named a method or a state that is not there, or the work
 * it started failed. `cause` holds the underlying error when there is
 * one.
 */
export class AutomationCallFailedError extends Error {
  constructor(method: string, reason: string, options?: { cause?: unknown }) {
    super(`${method}: ${reason}`, options);
    this.name = 'AutomationCallFailedError';
  }
}
