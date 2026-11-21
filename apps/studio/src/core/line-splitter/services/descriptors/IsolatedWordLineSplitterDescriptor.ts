import { DomProbeWordEdgeReader, IsolatedWordLineSplitter, type LineSplitter, type TagConditionParser, type WordEdgeReader } from '@tscaps/engine';
import type { ControlField } from '@core/templates/domain/definition/ControlField';
import type { LineSplitterContext, LineSplitterDescriptor } from '@core/line-splitter/domain/LineSplitterDescriptor';
import type { IsolatedWordLineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

export class IsolatedWordLineSplitterDescriptor implements LineSplitterDescriptor<IsolatedWordLineSplitterConfig> {
  readonly type = 'isolated-word' as const;

  readonly defaultConfig: IsolatedWordLineSplitterConfig = {
    type: 'isolated-word',
    minLetters: 4,
    minSecondsOnScreen: 0.8,
    fallbackMinSecondsOnScreen: 0.6,
  };

  // The two times on screen, the tag priority, where the search starts,
  // whether the first word can stand alone, the floors on words and line
  // length, the plain captions between lifts, how a word is picked and
  // whether only the ends can be lifted, and how even a word's edges must
  // be, stay out of the editor:
  // they are tuned per template in template.json, and read as noise to
  // someone editing captions.
  readonly controlsSchema: readonly ControlField[] = [
    { id: 'minLetters', label: 'Min letters in big word', type: 'integer', default: 4, min: 1, max: 12 },
  ];

  constructor(private readonly tagConditionParser: TagConditionParser) {}

  build(config: IsolatedWordLineSplitterConfig, context: LineSplitterContext): LineSplitter {
    return new IsolatedWordLineSplitter({
      minLetters: config.minLetters,
      minSecondsOnScreen: config.minSecondsOnScreen,
      fallbackMinSecondsOnScreen: config.fallbackMinSecondsOnScreen,
      tagPriority: (config.tagPriority ?? []).map((expression) => this.tagConditionParser.parse(expression)),
      searchFrom: config.searchFrom,
      allowFirstWord: config.allowFirstWord,
      minSegmentWords: config.minSegmentWords,
      minLineChars: config.minLineChars,
      minPlainSegmentsBetween: config.minPlainSegmentsBetween,
      pickBy: config.pickBy,
      onlyAtEnds: config.onlyAtEnds,
      maxEdgeSpreadEm: config.maxEdgeSpreadEm,
    }, this.edgeReaderFor(config, context));
  }

  /** A reader in the template's own fonts, only for a config that weighs a word's edges. */
  private edgeReaderFor(config: IsolatedWordLineSplitterConfig, context: LineSplitterContext): WordEdgeReader | null {
    if (config.maxEdgeSpreadEm === undefined) return null;
    return new DomProbeWordEdgeReader({
      css: context.css,
      cssVars: context.cssVars,
      containerWidth: context.videoWidth,
      containerHeight: context.videoHeight,
    });
  }
}
