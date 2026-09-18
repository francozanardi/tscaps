import type { ModelFileFetcher } from '@modules/transcription/ModelFileFetcher';
import { ModelFileRequestFailedError } from '@modules/transcription/ModelFileRequestFailedError';

/**
 * Requests each model file from its own host and, when that host
 * cannot be reached, asks a relay for the same path instead.
 *
 * The relay is a second way to the same bytes, not a replacement for
 * the first. Files are stored under the URL they were asked for, so
 * routing every request through the relay would rename every key and
 * cost each existing store its whole contents; going there only after
 * the direct route fails leaves the keys alone, and leaves the relay
 * carrying only the requests that would otherwise have failed.
 *
 * Only a host other than the relay's own is ever relayed. The runtime
 * asks for more than model files through the same entry point, its own
 * WebAssembly among them, and those are served by whoever serves the
 * relay: sending one of them through would ask the relay for a path it
 * exists to refuse.
 *
 * A host that has failed once is not asked again for the lifetime of
 * this fetcher. Reaching an unreachable host costs a connection
 * timeout, and a model is many files: without this, every one of them
 * would pay that wait again. The record is per host, so one host being
 * out of reach says nothing about the next.
 */
export class RelayFallbackModelFileFetcher implements ModelFileFetcher {
  private readonly unreachableOrigins = new Set<string>();

  /**
   * `relayBaseUrl` receives the requested URL's path and query appended
   * to it, so it has to name the root the relay forwards from, as an
   * absolute URL. A trailing slash is optional.
   *
   * `onHostUnreachable` is told the first time each host turns out to
   * be out of reach, and never again for that host. It reports a
   * condition the run recovers from, so it says nothing about whether
   * the file eventually arrived.
   */
  constructor(
    private readonly route: ModelFileFetcher,
    private readonly relayBaseUrl: string,
    private readonly onHostUnreachable: (origin: string, cause: unknown) => void = () => {},
  ) {}

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const origin = this.relayableOriginOf(url);
    if (origin === null) return this.route.fetch(url, init);
    if (this.unreachableOrigins.has(origin)) return this.route.fetch(this.relayUrlFor(url), init);
    try {
      return await this.route.fetch(url, init);
    } catch (directFailure) {
      if (!(directFailure instanceof ModelFileRequestFailedError)) throw directFailure;
      this.unreachableOrigins.add(origin);
      this.onHostUnreachable(origin, directFailure);
      return this.fetchThroughRelay(url, directFailure, init);
    }
  }

  /**
   * The origin this request could be relayed on behalf of, or `null`
   * when the relay is not a second way to it: a request the relay's own
   * host already serves, or an address with no host to compare.
   */
  private relayableOriginOf(url: string): string | null {
    try {
      const requested = new URL(url).origin;
      return requested === new URL(this.relayBaseUrl).origin ? null : requested;
    } catch {
      return null;
    }
  }

  private async fetchThroughRelay(
    url: string,
    directFailure: ModelFileRequestFailedError,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      return await this.route.fetch(this.relayUrlFor(url), init);
    } catch (relayFailure) {
      throw this.bothRoutesFailed(url, directFailure, relayFailure);
    }
  }

  /**
   * Neither attempt caused the other, so they travel as siblings and
   * the message names both. A report that reaches a dashboard
   * flattened still says which of the two ways in was tried and how
   * each of them ended.
   */
  private bothRoutesFailed(
    url: string,
    directFailure: ModelFileRequestFailedError,
    relayFailure: unknown,
  ): ModelFileRequestFailedError {
    const relayMessage = relayFailure instanceof Error ? relayFailure.message : String(relayFailure);
    return new ModelFileRequestFailedError(
      `Could not reach ${url} directly (${directFailure.message}) or through the relay (${relayMessage}).`,
      { cause: new AggregateError([directFailure, relayFailure], 'Both model file routes failed.') },
    );
  }

  private relayUrlFor(url: string): string {
    const requested = new URL(url);
    const base = this.relayBaseUrl.endsWith('/') ? this.relayBaseUrl : `${this.relayBaseUrl}/`;
    return `${base}${requested.pathname.replace(/^\//, '')}${requested.search}`;
  }
}
