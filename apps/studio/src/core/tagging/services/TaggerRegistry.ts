import { Line, type Document, type Section, type Segment, type Word } from '@tscaps/engine';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';
import type { TagName } from '@core/tagging/domain/TagName';
import { SemanticTagAggregator } from '@core/tagging/services/SemanticTagAggregator';

/**
 * Holds every platform tagger that runs as part of the preprocessing
 * pipeline. `runAll` fans every descriptor out in parallel against
 * the same input document, then folds their outputs back together by
 * unioning each word's semantic tags. Running in parallel keeps an
 * HTTP-bound AI descriptor from blocking a regex one; unioning by
 * `Word.id` means descriptors stay independent and the platform does
 * not have to order them.
 *
 * Adding a tagger is registering one more descriptor at wiring time.
 */
export class TaggerRegistry {

  constructor(private readonly descriptors: readonly TaggerDescriptor[]) {}

  async runAll(document: Document): Promise<Document> {
    if (this.descriptors.length === 0) return document;
    const variants = await Promise.all(this.descriptors.map((descriptor) => descriptor.apply(document)));
    return this.rebuildWithUnionedSemanticTags(document, variants);
  }

  list(): readonly TaggerDescriptor[] {
    return this.descriptors;
  }

  /**
   * Unique tag names produced by the currently registered taggers,
   * in registration order. Returned set is what the platform can
   * actually attach to a word right now — surfaces that expose tag
   * editing render from this, not from the canonical vocabulary.
   */
  listActiveTagNames(): readonly TagName[] {
    const seen = new Set<TagName>();
    const ordered: TagName[] = [];
    for (const descriptor of this.descriptors) {
      if (seen.has(descriptor.tagName)) continue;
      seen.add(descriptor.tagName);
      ordered.push(descriptor.tagName);
    }
    return ordered;
  }

  private rebuildWithUnionedSemanticTags(base: Document, variants: readonly Document[]): Document {
    const aggregator = new SemanticTagAggregator();
    for (const variant of variants) aggregator.ingest(variant);
    return this.rebuildDocument(base, aggregator);
  }

  private rebuildDocument(document: Document, aggregator: SemanticTagAggregator): Document {
    const sections = document.sections.map((section) => this.rebuildSection(section, aggregator));
    return document.with({ sections });
  }

  private rebuildSection(section: Section, aggregator: SemanticTagAggregator): Section {
    const segments = section.segments.map((segment) => this.rebuildSegment(segment, aggregator));
    return section.with({ segments });
  }

  private rebuildSegment(segment: Segment, aggregator: SemanticTagAggregator): Segment {
    const lines = segment.lines.map((line) => this.rebuildLine(line, aggregator));
    return segment.with({ lines });
  }

  private rebuildLine(line: Line, aggregator: SemanticTagAggregator): Line {
    const words = line.words.map((word) => this.rebuildWord(word, aggregator));
    return new Line({ words, structureTags: line.structureTags, id: line.id });
  }

  private rebuildWord(word: Word, aggregator: SemanticTagAggregator): Word {
    const merged = aggregator.semanticTagsFor(word.id);
    if (!merged) return word;
    return word.with({ semanticTags: merged });
  }
}
