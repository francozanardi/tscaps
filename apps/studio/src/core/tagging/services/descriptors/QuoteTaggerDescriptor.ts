import { SpanTagger, type Document } from '@tscaps/engine';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';

/**
 * Tags every word inside a quoted span, opening and closing
 * words included. The span propagates across line, segment, and
 * section boundaries; if the opening quote never closes, nothing
 * in the would-be span gets tagged.
 *
 * Recognized marks at boundaries: `"`, `“`, `”`, and `«`, `»`.
 * Single quotes are intentionally ignored to avoid collisions
 * with apostrophes ("don't", "it's").
 */
export class QuoteTaggerDescriptor implements TaggerDescriptor {
  readonly id = 'platform:quote';
  readonly tagName = 'quote';
  readonly appliedBy = 'client' as const;

  private readonly tagger = new SpanTagger(this.tagName, /^["“«]/, /["”»]$/);

  apply(document: Document): Promise<Document> {
    return Promise.resolve(this.tagger.tag(document));
  }
}
