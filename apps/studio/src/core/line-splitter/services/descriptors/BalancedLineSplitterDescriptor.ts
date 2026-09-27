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
    minCharsPerLine: 0,
  };

  // `maxCharsPerLine` reaches down to 4 for the full-frame templates,
  // which stack a handful of characters per line and size each one to
  // the video's width; below that "balanced" has nothing left to
  // balance and the break degenerates to one word per line. The floor
  // stops at 20 because past it no split clears the ceiling above and
  // the caption silently stops breaking at all.
  readonly controlsSchema: readonly ControlField[] = [
    { id: 'minLines', label: 'Min lines', type: 'integer', default: 1, min: 1, max: 4 },
    { id: 'maxLines', label: 'Max lines', type: 'integer', default: 2, min: 1, max: 4 },
    { id: 'maxCharsPerLine', label: 'Max chars per line', type: 'integer', default: 30, min: 4, max: 80 },
    { id: 'minCharsPerLine', label: 'Min chars per line', type: 'integer', default: 0, min: 0, max: 20 },
  ];

  build(config: BalancedLineSplitterConfig, _context: LineSplitterContext): LineSplitter {
    return new BalancedLineSplitter({
      maxLines: config.maxLines,
      minLines: config.minLines,
      maxCharsPerLine: config.maxCharsPerLine,
      minCharsPerLine: config.minCharsPerLine,
    });
  }
}
