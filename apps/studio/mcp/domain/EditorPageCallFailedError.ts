/**
 * A call to the editor page that did not succeed: the page answered with
 * an error (`pageErrorName` is its name, `message` its message), or gave
 * no answer in time, or the page was not there to ask.
 */
export class EditorPageCallFailedError extends Error {
  constructor(
    readonly method: string,
    message: string,
    readonly pageErrorName: string | null,
  ) {
    super(message);
    this.name = 'EditorPageCallFailedError';
  }

  /**
   * A call to `method` refused, unsent, because the job `running` holds
   * the page: the page answers one call at a time, so this one would
   * wait behind the job, outlast the tool call, and still run later.
   */
  static busy(method: string, running: string): EditorPageCallFailedError {
    return new EditorPageCallFailedError(method, `The editor is still busy with ${running}, and nothing was sent to it: call wait_for_job with that id until it is done, then call this again.`, null);
  }
}
