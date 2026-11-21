import { describe, expect, it } from 'vitest';
import { IndexedDbV10ToV11Migration } from '@core/_shared/infrastructure/migrations/IndexedDbV10ToV11Migration';

/** The stores that held the proxy's and the masks' own eviction orders go; nothing else does. */

function transactionOver(stores: string[]): { transaction: IDBTransaction; stores: Set<string> } {
  const held = new Set(stores);
  const db = {
    objectStoreNames: { contains: (name: string) => held.has(name) },
    deleteObjectStore: (name: string) => { held.delete(name); },
  };
  return { transaction: { db } as unknown as IDBTransaction, stores: held };
}

describe('IndexedDbV10ToV11Migration', () => {
  it('drops the retired eviction-order stores and keeps the rest', () => {
    const { transaction, stores } = transactionOver([
      'videos', 'videos-access', 'video-proxies', 'video-proxies-access', 'person-segmentation-cache-access',
    ]);

    new IndexedDbV10ToV11Migration().migrate(transaction);

    expect([...stores].sort()).toEqual(['video-proxies', 'videos', 'videos-access']);
  });

  it('runs on a database that never had them', () => {
    const { transaction, stores } = transactionOver(['videos']);

    new IndexedDbV10ToV11Migration().migrate(transaction);

    expect([...stores]).toEqual(['videos']);
  });
});
