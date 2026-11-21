// Node's http API names its response type ServerResponse. banned-words-allow-file: server-prefixed identifier
import type { ServerResponse } from 'node:http';
import type { PageChannel } from '@mcp/domain/PageChannel';
import { EditorPageCallFailedError } from '@mcp/domain/EditorPageCallFailedError';

/** A call sent to the page and not answered yet. */
interface PendingCall {
  readonly method: string;
  readonly resolve: (result: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

/** An answer the page posts back, as the page's automation bridge writes it. */
interface PageAnswer {
  readonly id: number;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: { readonly name: string; readonly message: string };
}

/**
 * The server's half of the page's channel: calls go to the page down a
 * server-sent event stream, and the page's answers come back through
 * `settle`. A page that reconnects (a reload, a dropped stream) replaces
 * the stream; calls sent to the old one are still answered if the old
 * page answers them, else they time out.
 */
export class AutomationRelay implements PageChannel {
  private stream: ServerResponse | null = null;
  private readonly connectedWaiters: Array<() => void> = [];
  private readonly pending = new Map<number, PendingCall>();
  private nextId = 1;

  /** Whether a page is connected now. */
  isConnected(): boolean {
    return this.stream !== null;
  }

  /** Resolves once a page is connected, or rejects after `timeoutMs`. */
  connected(timeoutMs: number): Promise<void> {
    if (this.stream !== null) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`the editor page did not connect within ${timeoutMs / 1000} s`)), timeoutMs);
      this.connectedWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Takes over `response` as the stream calls are sent down. */
  attach(response: ServerResponse): void {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    response.write(': connected\n\n');
    this.stream = response;
    response.on('close', () => {
      if (this.stream === response) this.stream = null;
    });
    for (const waiter of this.connectedWaiters.splice(0)) waiter();
  }

  async call(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const stream = this.stream;
    if (stream === null) throw new EditorPageCallFailedError(method, 'the editor page is not connected', null);
    const id = this.nextId++;
    const answer = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new EditorPageCallFailedError(method, `the editor page gave no answer within ${Math.round(timeoutMs / 1000)} s`, null));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
    });
    stream.write(`data: ${JSON.stringify({ id, method, params })}\n\n`);
    return answer;
  }

  /** Delivers an answer the page posted. An answer nobody waits for any more is dropped. */
  settle(answer: PageAnswer): void {
    const call = this.pending.get(answer.id);
    if (call === undefined) return;
    this.pending.delete(answer.id);
    clearTimeout(call.timer);
    if (answer.ok) {
      call.resolve(answer.result);
      return;
    }
    const error = answer.error ?? { name: 'Error', message: 'the page answered with no error' };
    call.reject(new EditorPageCallFailedError(call.method, error.message, error.name));
  }

  /** Ends the stream and fails every call still waiting. */
  close(): void {
    this.stream?.end();
    this.stream = null;
    for (const [id, call] of this.pending) {
      clearTimeout(call.timer);
      call.reject(new EditorPageCallFailedError(call.method, 'the session ended', null));
      this.pending.delete(id);
    }
  }
}
