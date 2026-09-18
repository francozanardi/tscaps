/**
 * What survives a worker's `postMessage` when a job fails.
 *
 * Structured clone drops `Error` subclasses, so the useful fields are
 * sent as plain data. The name is the load-bearing one: it is how a
 * browser condition worth acting on — running out of storage, a
 * transfer dying — stays distinguishable from a generic fault once it
 * reaches the owner.
 *
 * `cause` and `errors` carry what sits underneath, in the two shapes
 * the rest of the app already reads a failure through: a spine of
 * wrappers, and the siblings of a step that tried several strategies
 * and had all of them fail. A description holding only the outermost
 * link answers "which operation" and loses "why", which is the one
 * question a worker failure is usually opened to answer.
 */
export interface WorkerErrorDescription {
  readonly name: string;
  readonly message: string;
  readonly cause?: WorkerErrorDescription;
  readonly errors?: readonly WorkerErrorDescription[];
}

/**
 * A failure raised inside a worker and rebuilt on the owner thread
 * with its original `name` intact, and with everything underneath it
 * rebuilt the same way.
 */
export class WorkerBoundaryError extends Error {

  /**
   * How many errors one description may hold, across the spine and
   * every branch together. It bounds what a pathological chain costs
   * to clone, and matches the ceiling the telemetry renderer applies
   * to the same tree, so a description that crosses the boundary
   * intact also renders intact.
   */
  private static readonly MAX_LINKS = 8;

  /** The siblings of a failure that tried several strategies, when it had any. */
  readonly errors?: readonly WorkerBoundaryError[];

  /**
   * Flattens a thrown value into the fields that cross the boundary.
   *
   * `fallbackMessage` describes a thrown value that is not an error at
   * all, and is used only for the value handed in. Errors already
   * visited are not descended into again, so a chain pointing back
   * into itself terminates.
   */
  static describe(error: unknown, fallbackMessage: string): WorkerErrorDescription {
    return this.describeLink(error, fallbackMessage, new Set<object>());
  }

  private static describeLink(
    error: unknown,
    fallbackMessage: string,
    visited: Set<object>,
  ): WorkerErrorDescription {
    if (!this.isError(error)) return { name: 'Error', message: fallbackMessage };
    visited.add(error);
    return {
      name: error.name,
      message: error.message,
      ...this.describeBranches(error, visited),
      ...this.describeCause(error, visited),
    };
  }

  private static describeCause(error: Error, visited: Set<object>): Pick<WorkerErrorDescription, 'cause'> {
    const cause = (error as { cause?: unknown }).cause;
    if (!this.canDescend(cause, visited)) return {};
    return { cause: this.describeLink(cause, '', visited) };
  }

  private static describeBranches(error: Error, visited: Set<object>): Pick<WorkerErrorDescription, 'errors'> {
    const branches = (error as { errors?: unknown }).errors;
    if (!Array.isArray(branches)) return {};
    const described = branches
      .filter((branch) => this.canDescend(branch, visited))
      .map((branch) => this.describeLink(branch, '', visited));
    return described.length > 0 ? { errors: described } : {};
  }

  private static canDescend(candidate: unknown, visited: Set<object>): boolean {
    if (visited.size >= this.MAX_LINKS) return false;
    return this.isError(candidate) && !visited.has(candidate);
  }

  private static isError(candidate: unknown): candidate is Error {
    return candidate instanceof Error || candidate instanceof DOMException;
  }

  constructor(description: WorkerErrorDescription) {
    super(description.message, WorkerBoundaryError.rebuiltCause(description));
    this.name = description.name;
    if (description.errors) {
      this.errors = description.errors.map((branch) => new WorkerBoundaryError(branch));
    }
  }

  private static rebuiltCause(description: WorkerErrorDescription): ErrorOptions | undefined {
    if (!description.cause) return undefined;
    return { cause: new WorkerBoundaryError(description.cause) };
  }
}
