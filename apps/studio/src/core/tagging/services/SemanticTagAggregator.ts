import { Tag, type Document } from '@tscaps/engine';

/**
 * Collects the semantic tags every variant document assigned to each
 * word, then exposes the union as a `ReadonlySet<Tag>` keyed by word
 * id. Built from the variants produced by tagger descriptors running
 * in parallel against the same base document; the consumer rebuilds
 * the base document by reading this aggregator per word.
 *
 * Words absent from every variant are not stored — the consumer
 * keeps them as-is.
 */
export class SemanticTagAggregator {
  private readonly tagsByWordId = new Map<string, Set<string>>();

  ingest(variant: Document): void {
    for (const word of variant.getWords()) {
      this.ingestWordTagNames(word.id, word.semanticTags);
    }
  }

  semanticTagsFor(wordId: string): ReadonlySet<Tag> | null {
    const names = this.tagsByWordId.get(wordId);
    if (!names || names.size === 0) return null;
    const tags = new Set<Tag>();
    for (const name of names) tags.add(Tag.of(name));
    return tags;
  }

  private ingestWordTagNames(wordId: string, tags: ReadonlySet<Tag>): void {
    if (tags.size === 0) return;
    let bucket = this.tagsByWordId.get(wordId);
    if (!bucket) {
      bucket = new Set<string>();
      this.tagsByWordId.set(wordId, bucket);
    }
    for (const tag of tags) bucket.add(tag.name);
  }
}
