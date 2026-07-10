import { CompositeSegmentSplitter, type SegmentSplitter } from '@tscaps/engine';
import type { SegmentSplitterConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';
import type { SegmentSplitterContext, SegmentSplitterDescriptor } from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import { LimitByCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByCharsSegmentSplitterDescriptor';
import { LimitByScaledCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByScaledCharsSegmentSplitterDescriptor';
import { BoundaryScoreLimitByCharsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/BoundaryScoreLimitByCharsSegmentSplitterDescriptor';
import { LimitByWordsSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/LimitByWordsSegmentSplitterDescriptor';
import { BoundarySegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/BoundarySegmentSplitterDescriptor';
import { PauseBasedSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/PauseBasedSegmentSplitterDescriptor';
import { SpeakerChangeSegmentSplitterDescriptor } from '@core/segment-splitter/services/descriptors/SpeakerChangeSegmentSplitterDescriptor';

export class SegmentSplitterRegistry {
  private readonly _byType = new Map<string, SegmentSplitterDescriptor<SegmentSplitterConfig>>();

  constructor() {
    this.register(new SpeakerChangeSegmentSplitterDescriptor());
    this.register(new PauseBasedSegmentSplitterDescriptor());
    this.register(new BoundarySegmentSplitterDescriptor());
    this.register(new LimitByCharsSegmentSplitterDescriptor());
    this.register(new LimitByScaledCharsSegmentSplitterDescriptor());
    this.register(new BoundaryScoreLimitByCharsSegmentSplitterDescriptor());
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
}
