import { FixedTailLineSplitter, type LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { FixedTailLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class FixedTailLineSplitterDescriptor implements LineSplitterDescriptor<FixedTailLineSplitterConfig> {
  readonly type = 'fixed-tail' as const;

  readonly defaultConfig: FixedTailLineSplitterConfig = {
    type: 'fixed-tail',
    tailWordCount: 3,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'tailWordCount', label: 'Tail words', type: 'integer', default: 3, min: 1, max: 6 },
  ];

  build(config: FixedTailLineSplitterConfig, _context: LineSplitterContext): LineSplitter {
    return new FixedTailLineSplitter({ tailWordCount: config.tailWordCount });
  }
}
