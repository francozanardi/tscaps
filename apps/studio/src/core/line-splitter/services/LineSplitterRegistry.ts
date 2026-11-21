import { TagRoutedLineSplitter, type LineSplitter, type TagConditionParser } from '@tscaps/engine';
import type { TaggedLineSplitter } from '@core/line-splitter/domain/TaggedLineSplitter';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import { BalancedLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/BalancedLineSplitterDescriptor';
import { BalancedPixelWidthLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/BalancedPixelWidthLineSplitterDescriptor';
import { FixedTailLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/FixedTailLineSplitterDescriptor';
import { IsolatedWordLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/IsolatedWordLineSplitterDescriptor';

export class LineSplitterRegistry {
  private readonly _byType = new Map<string, LineSplitterDescriptor>();

  constructor(private readonly tagConditionParser: TagConditionParser) {
    this.register(new BalancedLineSplitterDescriptor());
    this.register(new BalancedPixelWidthLineSplitterDescriptor());
    this.register(new FixedTailLineSplitterDescriptor());
    this.register(new IsolatedWordLineSplitterDescriptor(tagConditionParser));
  }

  get(type: LineSplitterConfig['type']): LineSplitterDescriptor {
    const descriptor = this._byType.get(type);
    if (!descriptor) throw new Error(`Unknown line splitter type: ${type}`);
    return descriptor;
  }

  build(config: LineSplitterConfig, context: LineSplitterContext): LineSplitter {
    const descriptor = this.get(config.type) as LineSplitterDescriptor<typeof config>;
    return descriptor.build(config, context);
  }

  /**
   * A line splitter that breaks every caption carrying one of `tagged`'s
   * tags with that tag's splitter, and the others with `config`'s. With
   * nothing in `tagged` it is `build(config)`.
   */
  buildRouted(config: LineSplitterConfig, tagged: ReadonlyArray<TaggedLineSplitter>, context: LineSplitterContext): LineSplitter {
    const splitter = this.build(config, context);
    if (tagged.length === 0) return splitter;
    const routes = tagged.map((entry) => ({
      condition: this.tagConditionParser.parse(entry.tag),
      splitter: this.build(entry.lineSplitterConfig, context),
    }));
    return new TagRoutedLineSplitter(routes, splitter);
  }

  private register(descriptor: LineSplitterDescriptor): void {
    this._byType.set(descriptor.type, descriptor);
  }
}
