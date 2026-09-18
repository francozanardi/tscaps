import { describe, expect, it } from 'vitest';
import { RelayFallbackModelFileFetcher } from '@modules/transcription/RelayFallbackModelFileFetcher';
import { ModelFileRequestFailedError } from '@modules/transcription/ModelFileRequestFailedError';
import type { ModelFileFetcher } from '@modules/transcription/ModelFileFetcher';

const MODEL_URL = 'https://models.example/org/repo/resolve/main/config.json';
const RELAY = 'https://app.example/svc/m';

/**
 * Answers each URL from a table and records what it was asked for.
 * A URL the table does not name fails the way an unreachable host
 * does.
 */
class TableFetcher implements ModelFileFetcher {
  readonly requested: string[] = [];

  constructor(private readonly answers: Record<string, string>) {}

  async fetch(url: string): Promise<Response> {
    this.requested.push(url);
    const body = this.answers[url];
    if (body === undefined) throw new ModelFileRequestFailedError(`Could not reach ${url}.`);
    return new Response(body);
  }
}

describe('RelayFallbackModelFileFetcher', () => {
  it('keeps to the direct route while it answers', async () => {
    const route = new TableFetcher({ [MODEL_URL]: 'direct' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const response = await fetcher.fetch(MODEL_URL);

    expect(await response.text()).toBe('direct');
    expect(route.requested).toEqual([MODEL_URL]);
  });

  it('asks the relay for the same path when the host cannot be reached', async () => {
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const route = new TableFetcher({ [relayed]: 'relayed' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const response = await fetcher.fetch(MODEL_URL);

    expect(await response.text()).toBe('relayed');
  });

  it('carries the query string across to the relay', async () => {
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/model.onnx?download=true';
    const route = new TableFetcher({ [relayed]: 'relayed' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const response = await fetcher.fetch(`${MODEL_URL.replace('config.json', 'model.onnx')}?download=true`);

    expect(await response.text()).toBe('relayed');
  });

  /**
   * Reaching an unreachable host costs a connection timeout, and a
   * model is many files. Once the direct route has failed, every later
   * request has to go straight to the one that works.
   */
  it('stops trying the direct route once it has failed', async () => {
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const route = new TableFetcher({ [relayed]: 'relayed' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    await fetcher.fetch(MODEL_URL);
    await fetcher.fetch(MODEL_URL);

    expect(route.requested).toEqual([MODEL_URL, relayed, relayed]);
  });

  /**
   * The runtime asks for more than model files through the same entry
   * point, its own WebAssembly among them, and those are served by
   * whoever serves the relay. Sending one through would ask the relay
   * for a path it exists to refuse, which is a 403 in place of a file
   * the direct route was always going to hand over.
   */
  it('never relays a request the relay host already serves', async () => {
    const ownAsset = 'https://app.example/assets/runtime.wasm';
    const route = new TableFetcher({ [ownAsset]: 'runtime' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const response = await fetcher.fetch(ownAsset);

    expect(await response.text()).toBe('runtime');
    expect(route.requested).toEqual([ownAsset]);
  });

  it('keeps serving the relay host directly after another host went dark', async () => {
    const ownAsset = 'https://app.example/assets/runtime.wasm';
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const route = new TableFetcher({ [relayed]: 'relayed', [ownAsset]: 'runtime' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    await fetcher.fetch(MODEL_URL);
    const response = await fetcher.fetch(ownAsset);

    expect(await response.text()).toBe('runtime');
    expect(route.requested).toEqual([MODEL_URL, relayed, ownAsset]);
  });

  /**
   * One host being out of reach says nothing about the next, so the
   * record of what failed is kept per host rather than as a single
   * flag over the fetcher.
   */
  it('still tries a second host directly after the first one failed', async () => {
    const other = 'https://other-models.example/org/repo/resolve/main/config.json';
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const route = new TableFetcher({ [relayed]: 'relayed', [other]: 'other' });
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    await fetcher.fetch(MODEL_URL);
    const response = await fetcher.fetch(other);

    expect(await response.text()).toBe('other');
    expect(route.requested).toEqual([MODEL_URL, relayed, other]);
  });

  /**
   * There is no second way to the relay's own host: asking it to relay
   * a path it serves itself trades a real failure for a refusal that
   * describes nothing. The failure has to surface as it happened.
   */
  it('does not relay the relay host even when a request to it fails', async () => {
    const ownAsset = 'https://app.example/assets/runtime.wasm';
    const route = new TableFetcher({});
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const failure = await fetcher.fetch(ownAsset).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ModelFileRequestFailedError);
    expect((failure as Error).message).toBe(`Could not reach ${ownAsset}.`);
    expect(route.requested).toEqual([ownAsset]);
  });

  /**
   * A run that falls back looks identical to one that never had a
   * problem, so the condition is invisible unless the change of route
   * is announced on its own.
   */
  it('announces each host it gives up on, once', async () => {
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const route = new TableFetcher({ [relayed]: 'relayed' });
    const announced: string[] = [];
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY, (origin) => announced.push(origin));

    await fetcher.fetch(MODEL_URL);
    await fetcher.fetch(MODEL_URL);

    expect(announced).toEqual(['https://models.example']);
  });

  it('says nothing about a host that answered', async () => {
    const route = new TableFetcher({ [MODEL_URL]: 'direct' });
    const announced: string[] = [];
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY, (origin) => announced.push(origin));

    await fetcher.fetch(MODEL_URL);

    expect(announced).toEqual([]);
  });

  it('reports both attempts when neither route answers', async () => {
    const route = new TableFetcher({});
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const failure = await fetcher.fetch(MODEL_URL).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ModelFileRequestFailedError);
    const branches = ((failure as Error).cause as AggregateError).errors as Error[];
    expect(branches.map((branch) => branch.message)).toEqual([
      `Could not reach ${MODEL_URL}.`,
      'Could not reach https://app.example/svc/m/org/repo/resolve/main/config.json.',
    ]);
  });

  /**
   * A response the host produced is an answer, whatever its status.
   * Only a request that never arrived is worth a second route.
   */
  it('hands back a refusal the host answered with instead of relaying it', async () => {
    const route = new TableFetcher({});
    route.fetch = async (url: string) => {
      route.requested.push(url);
      return new Response('gone', { status: 404 });
    };
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    const response = await fetcher.fetch(MODEL_URL);

    expect(response.status).toBe(404);
    expect(route.requested).toEqual([MODEL_URL]);
  });

  it('lets a failure that is not about reaching the host through untouched', async () => {
    const refusal = new Error('the runtime is shutting down');
    const route: ModelFileFetcher = { fetch: () => Promise.reject(refusal) };
    const fetcher = new RelayFallbackModelFileFetcher(route, RELAY);

    await expect(fetcher.fetch(MODEL_URL)).rejects.toBe(refusal);
  });

  it('accepts a relay base with or without a trailing slash', async () => {
    const relayed = 'https://app.example/svc/m/org/repo/resolve/main/config.json';
    const withSlash = new TableFetcher({ [relayed]: 'relayed' });
    const fetcher = new RelayFallbackModelFileFetcher(withSlash, `${RELAY}/`);

    const response = await fetcher.fetch(MODEL_URL);

    expect(await response.text()).toBe('relayed');
  });
});
