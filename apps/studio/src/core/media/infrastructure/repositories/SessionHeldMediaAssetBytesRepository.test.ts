import { describe, expect, it } from 'vitest';
import type { BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { FakeIndexedDbClient } from '@core/_shared/infrastructure/FakeIndexedDbClient';
import type { UnsentMediaAssets } from '@core/media/domain/UnsentMediaAssets';
import {
  IndexedDbMediaAssetBytesRepository,
  MEDIA_ASSET_BYTES_STORE,
} from '@core/media/infrastructure/repositories/IndexedDbMediaAssetBytesRepository';
import { SessionHeldMediaAssetBytesRepository } from '@core/media/infrastructure/repositories/SessionHeldMediaAssetBytesRepository';

/**
 * A file added before its project had an id is held for the page; once
 * the project takes it, its bytes must outlive the page like any other
 * project file's. A second repository over the same database is what a
 * reload sees.
 */

const READABLE: BlobReadabilityProbe = { probe: () => Promise.resolve('readable') };
const NOTHING_UNSENT: UnsentMediaAssets = { unsentIds: () => Promise.resolve(new Set()) };

function harness() {
  const db = new FakeIndexedDbClient({ [MEDIA_ASSET_BYTES_STORE]: 'key' });
  const open = () => new SessionHeldMediaAssetBytesRepository(new IndexedDbMediaAssetBytesRepository(db.asClient(), READABLE, NOTHING_UNSENT));
  return { open };
}

describe('bytes held for the session', () => {
  it('are kept durably, every rendition, once the asset is given to a project', async () => {
    const { open } = harness();
    const page = open();
    await page.store({ id: 'clip', owner: { kind: 'session' } }, 'original', new Blob(['original']));
    await page.store({ id: 'clip', owner: { kind: 'session' } }, 'proxy', new Blob(['proxy']));

    await page.reassign('clip', { kind: 'project', projectId: 'p' });

    const afterReload = open();
    expect(await (await afterReload.load('clip', 'original'))?.text()).toBe('original');
    expect(await (await afterReload.load('clip', 'proxy'))?.text()).toBe('proxy');
  });

  it('do not outlive the page while the asset stays the session\'s', async () => {
    const { open } = harness();
    const page = open();
    await page.store({ id: 'clip', owner: { kind: 'session' } }, 'original', new Blob(['original']));

    expect(await open().load('clip', 'original')).toBeNull();
  });
});
