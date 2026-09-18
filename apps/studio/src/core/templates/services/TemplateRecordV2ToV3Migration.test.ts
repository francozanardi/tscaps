import { describe, expect, it } from 'vitest';
import { TemplateRecordV2ToV3Migration } from '@core/templates/services/TemplateRecordV2ToV3Migration';

describe('TemplateRecordV2ToV3Migration', () => {
  const migration = new TemplateRecordV2ToV3Migration();

  function metadataOf(record: Record<string, unknown>): Record<string, unknown> {
    return migration.migrate(record)['metadata'] as Record<string, unknown>;
  }

  it('carries a saved template\'s refusals over to the new field', () => {
    const metadata = metadataOf({ metadata: { id: 'x', unsupportedUserAgents: ['firefox'] } });
    expect(metadata['unsupportedBrowsers']).toEqual(['firefox']);
    expect(metadata).not.toHaveProperty('unsupportedUserAgents');
    expect(metadata['id']).toBe('x');
  });

  // v2 matched case-insensitively, so a record may hold any casing.
  it('lowercases what it keeps', () => {
    expect(metadataOf({ metadata: { unsupportedUserAgents: ['Firefox'] } })['unsupportedBrowsers'])
      .toEqual(['firefox']);
  });

  // A user-agent fragment matched nothing a browser answers to exactly,
  // so keeping it would newly restrict a template that was being offered.
  it('drops a value no browser answers to', () => {
    expect(metadataOf({ metadata: { unsupportedUserAgents: ['Gecko/20100101', 42] } })['unsupportedBrowsers'])
      .toEqual([]);
  });

  it('gives a record that declared nothing an empty list', () => {
    expect(metadataOf({ metadata: { id: 'x' } })['unsupportedBrowsers']).toEqual([]);
  });

  it('leaves a record with no metadata alone', () => {
    expect(migration.migrate({ css: '' })).toEqual({ css: '' });
  });

  it('upgrades from v2', () => {
    expect(migration.fromVersion).toBe(2);
  });
});
