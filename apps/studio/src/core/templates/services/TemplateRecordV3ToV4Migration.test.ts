import { describe, expect, it } from 'vitest';
import { TemplateRecordV3ToV4Migration } from '@core/templates/services/TemplateRecordV3ToV4Migration';

describe('TemplateRecordV3ToV4Migration', () => {
  const migration = new TemplateRecordV3ToV4Migration();

  it('moves a template saved from the old family into magazine', () => {
    const migrated = migration.migrate({ css: '', metadata: { id: 'x', name: 'Mine', category: 'key-moments' } });
    expect(migrated).toEqual({ css: '', metadata: { id: 'x', name: 'Mine', category: 'magazine' } });
  });

  it('leaves a template saved from any other family alone', () => {
    const record = { metadata: { id: 'x', category: 'viral' } };
    expect(migration.migrate(record)).toEqual(record);
  });

  it('leaves a record with no metadata alone', () => {
    expect(migration.migrate({ css: '' })).toEqual({ css: '' });
  });

  it('upgrades from v3', () => {
    expect(migration.fromVersion).toBe(3);
  });
});
