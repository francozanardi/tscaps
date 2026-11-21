import type { EditorPage } from '@mcp/domain/EditorPage';

/** The channel to the editor page: calls to it, and whether a page is on the other end. */
export interface PageChannel extends EditorPage {
  isConnected(): boolean;
  /** Resolves once a page is connected, or rejects after `timeoutMs`. */
  connected(timeoutMs: number): Promise<void>;
}
