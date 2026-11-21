import type { LineSplitterConfig } from '@core/line-splitter/domain/LineSplitterConfig';

/** The line splitter that breaks the captions whose words carry `tag`. */
export interface TaggedLineSplitter {
  readonly tag: string;
  readonly lineSplitterConfig: LineSplitterConfig;
}
