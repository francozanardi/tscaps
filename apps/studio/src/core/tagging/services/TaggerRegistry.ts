import { Line, type Document, type Section, type Segment, type Word } from '@tscaps/engine';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';
import { SemanticTagAggregator } from '@core/tagging/services/SemanticTagAggregator';

/**
 * Holds every platform tagger. `runAll` fans the automatic descriptors
 * out in parallel against the same input document, then folds their
 * outputs back together by unioning each word's semantic tags. Running
 * in parallel keeps an HTTP-bound AI descriptor from blocking a regex
 * one; unioning by `Word.id` means descriptors stay independent and the
 * platform does not have to order them.
 *
 * An `on-demand` descriptor is excluded from `runAll` and reached
 * through `runOne` instead, so a tagger whose tags cost a request is
 * never paid for by a pipeline nobody asked to run.
 *
 * Adding a tagger is registering one more descriptor at wiring time.
 */
export class TaggerRegistry {

  constructor(private readonly descriptors: readonly TaggerDescriptor[]) {}

  async runAll(document: Document): Promise<Document> {
    const automatic = this.descriptors.filter((descriptor) => descriptor.appliedBy !== 'on-demand');
    if (automatic.length === 0) return document;
    const variants = await Promise.all(automatic.map((descriptor) => descriptor.apply(document)));
    return this.rebuildWithUnionedSemanticTags(document, variants);
  }

  /**
   * Applies the one descriptor registered under `taggerId` and merges
   * its tags into the document, leaving every tag already on a word in
   * place. Returns the document unchanged when no descriptor carries
   * that id. Failures raised by the descriptor propagate.
   */
  async runOne(taggerId: string, document: Document): Promise<Document> {
    const descriptor = this.descriptors.find((candidate) => candidate.id === taggerId);
    if (!descriptor) return document;
    const variant = await descriptor.apply(document);
    return this.rebuildWithUnionedSemanticTags(document, [variant]);
  }

  list(): readonly TaggerDescriptor[] {
    return this.descriptors;
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
    return line.with({ words });
  }

  private rebuildWord(word: Word, aggregator: SemanticTagAggregator): Word {
    const merged = aggregator.semanticTagsFor(word.id);
    if (!merged) return word;
    return word.with({ semanticTags: merged });
  }
}
