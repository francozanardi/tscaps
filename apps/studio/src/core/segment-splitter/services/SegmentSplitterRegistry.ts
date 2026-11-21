import {
  CompositeSegmentSplitter,
  TagBoundarySegmentSplitter,
  TagRoutedSegmentSplitter,
  type SegmentSplitter,
  type TagConditionParser,
} from '@tscaps/engine';
import type { TaggedSegmentPipeline } from '@core/segment-splitter/domain/TaggedSegmentPipeline';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SegmentSplitterContext, SegmentSplitterDescriptor } from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import { LimitByCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByCharsSegmentSplitterDescriptor';
import { LimitByScaledCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByScaledCharsSegmentSplitterDescriptor';
import { BoundaryScoreLimitByCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/BoundaryScoreLimitByCharsSegmentSplitterDescriptor';
import { OptimalLimitByCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/OptimalLimitByCharsSegmentSplitterDescriptor';
import { LimitByWordsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByWordsSegmentSplitterDescriptor';
import { BoundarySegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/BoundarySegmentSplitterDescriptor';
import { PauseBasedSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/PauseBasedSegmentSplitterDescriptor';
import { SpeakerChangeSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/SpeakerChangeSegmentSplitterDescriptor';
import { CueChangeSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/CueChangeSegmentSplitterDescriptor';

export class SegmentSplitterRegistry {
  private readonly _byType = new Map<string, SegmentSplitterDescriptor<SegmentSplitterConfig>>();

  constructor(private readonly tagConditionParser: TagConditionParser) {
    this.register(new SpeakerChangeSegmentSplitterDescriptor());
    this.register(new CueChangeSegmentSplitterDescriptor());
    this.register(new PauseBasedSegmentSplitterDescriptor());
    this.register(new BoundarySegmentSplitterDescriptor());
    this.register(new LimitByCharsSegmentSplitterDescriptor());
    this.register(new LimitByScaledCharsSegmentSplitterDescriptor());
    this.register(new BoundaryScoreLimitByCharsSegmentSplitterDescriptor());
    this.register(new OptimalLimitByCharsSegmentSplitterDescriptor(tagConditionParser));
    this.register(new LimitByWordsSegmentSplitterDescriptor());
  }

  private register<TConfig extends SegmentSplitterConfig>(descriptor: SegmentSplitterDescriptor<TConfig>): void {
    this._byType.set(descriptor.type, descriptor as unknown as SegmentSplitterDescriptor<SegmentSplitterConfig>);
  }

  get(type: string): SegmentSplitterDescriptor<SegmentSplitterConfig> {
    const descriptor = this._byType.get(type);
    if (!descriptor) throw new Error(`Unknown segment splitter type: ${type}`);
    return descriptor;
  }

  build(config: SegmentSplitterConfig, context: SegmentSplitterContext): SegmentSplitter {
    return this.get(config.type).build(config, context);
  }

  /**
   * Builds a composite splitter that runs the given configs in declared
   * order. Used by the deriver to materialize the per-sheet pipeline from
   * a sheet's `segmentSplitters` array.
   */
  buildPipeline(configs: ReadonlyArray<SegmentSplitterConfig>, context: SegmentSplitterContext): SegmentSplitter {
    return new CompositeSegmentSplitter(configs.map((c) => this.build(c, context)));
  }

  /**
   * The pipeline of captions some of whose words go their own way: the
   * words carrying each of `tagged`'s tags are first cut apart from the
   * rest, then every caption goes through the pipeline of the tag it
   * carries, and the others through `configs`. With nothing in `tagged`
   * it is `buildPipeline(configs)`.
   */
  buildRoutedPipeline(
    configs: ReadonlyArray<SegmentSplitterConfig>,
    tagged: ReadonlyArray<TaggedSegmentPipeline>,
    context: SegmentSplitterContext,
  ): SegmentSplitter {
    const pipeline = this.buildPipeline(configs, context);
    if (tagged.length === 0) return pipeline;
    const routes = tagged.map((entry) => ({
      condition: this.tagConditionParser.parse(entry.tag),
      splitter: this.buildPipeline(entry.segmentSplitterConfigs, context),
    }));
    return new CompositeSegmentSplitter([
      ...routes.map((route) => new TagBoundarySegmentSplitter(route.condition)),
      new TagRoutedSegmentSplitter(routes, pipeline),
    ]);
  }
}
