import { IsolatedWordLineSplitter, type LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterDescriptor, LineSplitterContext } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { IsolatedWordLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class IsolatedWordLineSplitterDescriptor implements LineSplitterDescriptor<IsolatedWordLineSplitterConfig> {
  readonly type = 'isolated-word' as const;

  readonly defaultConfig: IsolatedWordLineSplitterConfig = {
    type: 'isolated-word',
    minLetters: 4,
    minSecondsOnScreen: 0.8,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'minLetters', label: 'Min letters in big word', type: 'integer', default: 4, min: 1, max: 12 },
    { id: 'minSecondsOnScreen', label: 'Min time on screen', type: 'float', default: 0.8, min: 0, max: 3, step: 0.05, unit: 's' },
  ];

  build(config: IsolatedWordLineSplitterConfig, context: LineSplitterContext): LineSplitter {
    return new IsolatedWordLineSplitter({
      minLetters: config.minLetters,
      minSecondsOnScreen: config.minSecondsOnScreen,
      holdAfterLastWordSeconds: context.holdAfterLastWordSeconds,
    });
  }
}
