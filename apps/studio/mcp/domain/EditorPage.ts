/**
 * The editor page a session drives, as a program sees it: one call at a
 * time is enough, but several may be in flight. `call` resolves with the
 * method's result, or rejects with `EditorPageCallFailedError` carrying
 * the page's own error, or when no answer came within `timeoutMs`.
 */
export interface EditorPage {
  call(method: string, params: unknown, timeoutMs: number): Promise<unknown>;
}
