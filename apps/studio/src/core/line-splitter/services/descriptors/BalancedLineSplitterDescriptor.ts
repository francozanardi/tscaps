import { BalancedLineSplitter, type LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { BalancedLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class BalancedLineSplitterDescriptor implements LineSplitterDescriptor<BalancedLineSplitterConfig> {
  readonly type = 'balanced' as const;

  readonly defaultConfig: BalancedLineSplitterConfig = {
    type: 'balanced',
    maxLines: 2,
    minLines: 1,
    maxCharsPerLine: 30,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'maxLines', label: 'Max lines', type: 'integer', default: 2, min: 1, max: 4 },
    { id: 'minLines', label: 'Min lines', type: 'integer', default: 1, min: 1, max: 4 },
    { id: 'maxCharsPerLine', label: 'Max chars per line', type: 'integer', default: 30, min: 10, max: 80 },
  ];

  build(config: BalancedLineSplitterConfig, _context: LineSplitterContext): LineSplitter {
    return new BalancedLineSplitter({
      maxLines: config.maxLines,
      minLines: config.minLines,
      maxCharsPerLine: config.maxCharsPerLine,
    });
  }
}
