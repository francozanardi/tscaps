import { IsolatedWordLineSplitter, type LineSplitter } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterDescriptor } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { IsolatedWordLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class IsolatedWordLineSplitterDescriptor implements LineSplitterDescriptor<IsolatedWordLineSplitterConfig> {
  readonly type = 'isolated-word' as const;

  readonly defaultConfig: IsolatedWordLineSplitterConfig = {
    type: 'isolated-word',
    minLetters: 4,
    minSecondsOnScreen: 0.8,
    fallbackMinSecondsOnScreen: 0.6,
  };

  // The two times on screen stay out of the editor: they are tuned per
  // template in template.json, and read as noise to someone editing
  // captions.
  readonly controlsSchema: readonly ControlField[] = [
    { id: 'minLetters', label: 'Min letters in big word', type: 'integer', default: 4, min: 1, max: 12 },
  ];

  build(config: IsolatedWordLineSplitterConfig): LineSplitter {
    return new IsolatedWordLineSplitter({
      minLetters: config.minLetters,
      minSecondsOnScreen: config.minSecondsOnScreen,
      fallbackMinSecondsOnScreen: config.fallbackMinSecondsOnScreen,
    });
  }
}
