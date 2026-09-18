/**
 * Performs the requests that bring model files in.
 *
 * An implementation reports a transport failure — a request that never
 * produced a response — as a `ModelFileRequestFailedError`, and hands
 * back every response it does receive, including refusals carrying a
 * status.
 */
export interface ModelFileFetcher {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}
