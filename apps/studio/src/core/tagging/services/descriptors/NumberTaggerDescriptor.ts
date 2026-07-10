import { RegexTagger, type Document } from '@tscaps/engine';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';

/**
 * Tags words that are purely numeric: integers and decimals,
 * optionally with `.` or `,` as thousand/decimal separators
 * (e.g. "2024", "1.5", "1,000"). Rejects alphanumeric mixes
 * like "v3" or "10x".
 */
export class NumberTaggerDescriptor implements TaggerDescriptor {
  readonly id = 'platform:number';
  readonly tagName = 'number';
  readonly appliedBy = 'client' as const;

  private readonly tagger = new RegexTagger(this.tagName, /^\d+([.,]\d+)*$/);

  apply(document: Document): Promise<Document> {
    return Promise.resolve(this.tagger.tag(document));
  }
}
