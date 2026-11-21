import { describe, expect, it } from 'vitest';
import { IndexedDbV12ToV13Migration } from '@core/_shared/infrastructure/migrations/IndexedDbV12ToV13Migration';

/** The stores that held a project's files by project go; the assets' own stores and the rest stay. */

function transactionOver(stores: string[]): { transaction: IDBTransaction; stores: Set<string> } {
  const held = new Set(stores);
  const db = {
    objectStoreNames: { contains: (name: string) => held.has(name) },
    deleteObjectStore: (name: string) => { held.delete(name); },
  };
  return { transaction: { db } as unknown as IDBTransaction, stores: held };
}

describe('IndexedDbV12ToV13Migration', () => {
  it('drops the retired project-file stores and keeps the rest', () => {
    const { transaction, stores } = transactionOver([
      'videos', 'project-media', 'project-media-proxies', 'media-assets', 'media-asset-bytes',
    ]);

    new IndexedDbV12ToV13Migration().migrate(transaction);

    expect([...stores].sort()).toEqual(['media-asset-bytes', 'media-assets', 'videos']);
  });

  it('runs on a database that never had them', () => {
    const { transaction, stores } = transactionOver(['videos']);

    new IndexedDbV12ToV13Migration().migrate(transaction);

    expect([...stores]).toEqual(['videos']);
  });
});
