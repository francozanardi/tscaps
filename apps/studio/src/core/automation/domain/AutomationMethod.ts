/**
 * One thing a program driving the editor from outside the page can ask
 * for, by `name`. `run` validates `params` itself and rejects with an
 * error whose name says what failed; the rejection becomes the call's
 * failed answer.
 */
export interface AutomationMethod {
  readonly name: string;
  run(params: unknown): Promise<unknown>;
}
