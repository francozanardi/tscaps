import { DECLARABLE_BROWSERS } from '@core/browser-support/domain/DeclarableBrowser';
import type { TemplateRecordMigration } from '@core/templates/domain/favorites/TemplateRecordMigration';

/**
 * v2 → v3: renames `metadata.unsupportedUserAgents` to
 * `metadata.unsupportedBrowsers` and narrows its values to the
 * browsers the app detects.
 *
 * v2 held case-insensitive substrings tested against
 * `navigator.userAgent`; v3 holds exact `BrowserName` values. The two
 * agree on every value ever persisted — a saved template inherits the
 * list from the built-in it was forked off, and the only one any
 * built-in ever declared is `"firefox"` — so the step lowercases and
 * keeps what a browser answers to, and drops the rest. Dropping is the
 * safe direction: it restores nothing worse than the template being
 * offered, which is what an unmatched substring already did.
 */
export class TemplateRecordV2ToV3Migration implements TemplateRecordMigration {
  readonly fromVersion = 2;

  migrate(record: Record<string, unknown>): Record<string, unknown> {
    if (!this.isRecord(record.metadata)) return record;
    const { unsupportedUserAgents, ...metadata } = record.metadata;
    return {
      ...record,
      metadata: { ...metadata, unsupportedBrowsers: this.browsersIn(unsupportedUserAgents) },
    };
  }

  private browsersIn(declared: unknown): string[] {
    if (!Array.isArray(declared)) return [];
    return declared
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.toLowerCase())
      .filter((entry) => Object.hasOwn(DECLARABLE_BROWSERS, entry));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
