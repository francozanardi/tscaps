import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * What happens to a page when another version of the app upgrades the
 * database is the browser's answer, so it is asked of a real one. Each
 * scenario opens two clients on one database at different versions,
 * standing for a tab still running an old build and a tab that loaded
 * the new one: two connections behave the same in one page as in two.
 *
 * The page is served on `http://localhost` through route interception,
 * because IndexedDB is not available to a page without an origin.
 */

const FIXTURE_ID = 'virtual:indexed-db-client-fixture';
const FIXTURE_SOURCE = `
  export { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
  export { IndexedDbMigrator } from '@core/_shared/infrastructure/migrations/IndexedDbMigrator';
`;

/** What one scenario saw: each request's outcome (`ok` or the error's name), and what the older client said. */
interface Outcome {
  readonly requests: Readonly<Record<string, string>>;
  readonly causeOfRefusal: string | null;
  readonly trigger: string | null;
  readonly told: readonly string[];
  readonly readByNewer: readonly string[];
}

type Scenario = 'upgraded-while-open' | 'newer-on-open' | 'deleted-while-open';

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'indexed-db-client-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@core': resolve(import.meta.dirname, '../..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}

async function freshPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto('http://localhost/indexed-db-client-test');
  await page.addScriptTag({ content: bundle });
  return page;
}

/**
 * Runs `scenario` in a page of its own: an older client (version 1)
 * holds the database with one item in it, then a newer client
 * (version 2) upgrades it, or the database is already at version 2
 * when the older client first asks, or it is deleted while held. The
 * older client then writes and reads twice.
 */
async function run(scenario: Scenario): Promise<Outcome> {
  const page = await freshPage();
  try {
    return await page.evaluate(async (scenario) => {
      interface Client {
        writeOne(store: string, value: object): Promise<void>;
        readAll<T>(store: string): Promise<T[]>;
        onPageOutdated(listener: (trigger: string) => void): () => void;
        outdatedPageTrigger(): string | null;
      }
      const fixture = (window as never as {
        fixture: {
          IndexedDbClient: new (config: object) => Client;
          IndexedDbMigrator: new (steps: readonly never[], targetVersion: number) => object;
        };
      }).fixture;
      const dbName = `client-${scenario}`;
      const clientAt = (version: number): Client => new fixture.IndexedDbClient({
        dbName,
        dbVersion: version,
        stores: [{ name: 'items', keyPath: 'id' }],
        migrator: new fixture.IndexedDbMigrator([], version),
      });
      const deleteDatabase = (): Promise<void> => new Promise((done, fail) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => done();
        request.onerror = () => fail(request.error);
      });

      const older = clientAt(1);
      const newer = clientAt(2);
      const told: string[] = [];
      older.onPageOutdated((trigger) => told.push(trigger));
      let readByNewer: string[] = [];
      if (scenario === 'newer-on-open') {
        await newer.writeOne('items', { id: 'stored' });
      } else {
        await older.writeOne('items', { id: 'stored' });
        if (scenario === 'upgraded-while-open') {
          readByNewer = (await newer.readAll<{ id: string }>('items')).map((item) => item.id);
        } else {
          await deleteDatabase();
        }
      }

      const requests: Record<string, string> = {};
      let causeOfRefusal: string | null = null;
      const attempt = async (label: string, request: () => Promise<unknown>): Promise<void> => {
        try {
          await request();
          requests[label] = 'ok';
        } catch (error) {
          requests[label] = (error as Error).name;
          const cause = (error as { cause?: { name?: string } }).cause;
          causeOfRefusal ??= cause?.name ?? null;
        }
      };
      await attempt('first write', () => older.writeOne('items', { id: 'later' }));
      await attempt('first read', () => older.readAll('items'));
      await attempt('second write', () => older.writeOne('items', { id: 'later still' }));
      await attempt('second read', () => older.readAll('items'));
      return { requests, causeOfRefusal, trigger: older.outdatedPageTrigger(), told, readByNewer };
    }, scenario);
  } finally {
    await page.close();
  }
}

const EVERY_REQUEST_REFUSED = {
  'first write': 'IndexedDbSupersededError',
  'first read': 'IndexedDbSupersededError',
  'second write': 'IndexedDbSupersededError',
  'second read': 'IndexedDbSupersededError',
};

describe('IndexedDbClient when another version of the app takes the database', () => {
  it('lets a newer version upgrade the database it holds', async () => {
    const outcome = await run('upgraded-while-open');

    expect(outcome.readByNewer).toEqual(['stored']);
  });

  it('refuses every later request once a newer version has upgraded the database', async () => {
    const outcome = await run('upgraded-while-open');

    expect(outcome.requests).toEqual(EVERY_REQUEST_REFUSED);
  });

  it('says once that the page is outdated, however many requests fail after', async () => {
    const outcome = await run('upgraded-while-open');

    expect(outcome.trigger).toBe('upgraded-while-open');
    expect(outcome.told).toEqual(['upgraded-while-open']);
  });

  it('refuses a database already newer than its own version, with the browser refusal as the cause', async () => {
    const outcome = await run('newer-on-open');

    expect(outcome.requests).toEqual(EVERY_REQUEST_REFUSED);
    expect(outcome.causeOfRefusal).toBe('VersionError');
    expect(outcome.told).toEqual(['newer-on-open']);
  });

  /**
   * A deletion also takes the database away from the page, but leaves
   * nothing the page's code is too old for: the next request creates
   * the database again at the page's own version.
   */
  it('keeps working after the database is deleted elsewhere', async () => {
    const outcome = await run('deleted-while-open');

    expect(outcome.requests).toEqual({
      'first write': 'ok',
      'first read': 'ok',
      'second write': 'ok',
      'second read': 'ok',
    });
    expect(outcome.trigger).toBeNull();
    expect(outcome.told).toEqual([]);
  });
});
