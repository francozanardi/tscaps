/** Why a call failed: the error's name, for a program to switch on, and its message. */
export interface AutomationFailure {
  readonly name: string;
  readonly message: string;
}

/** The answer to one `AutomationCall`, under its `id`: what the method returned, or why it failed. */
export type AutomationAnswer =
  | { readonly id: number; readonly ok: true; readonly result: unknown }
  | { readonly id: number; readonly ok: false; readonly error: AutomationFailure };
