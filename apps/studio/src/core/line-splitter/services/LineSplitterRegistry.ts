import type { LineSplitter } from '@tscaps/engine';
import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import { BalancedLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/BalancedLineSplitterDescriptor';
import { BalancedPixelWidthLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/BalancedPixelWidthLineSplitterDescriptor';
import { FixedTailLineSplitterDescriptor } from '@core/line-splitter/services/descriptors/FixedTailLineSplitterDescriptor';

export class LineSplitterRegistry {
  private readonly _byType = new Map<string, LineSplitterDescriptor>();

  constructor() {
    this.register(new BalancedLineSplitterDescriptor());
    this.register(new BalancedPixelWidthLineSplitterDescriptor());
    this.register(new FixedTailLineSplitterDescriptor());
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

  private register(descriptor: LineSplitterDescriptor): void {
    this._byType.set(descriptor.type, descriptor);
  }
}
