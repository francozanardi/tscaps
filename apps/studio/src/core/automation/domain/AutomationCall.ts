/**
 * One request a program driving the editor from outside the page sends:
 * `method` names what to do, `params` carries its input as plain JSON,
 * and `id` pairs it with its answer.
 */
export interface AutomationCall {
  readonly id: number;
  readonly method: string;
  readonly params: unknown;
}
