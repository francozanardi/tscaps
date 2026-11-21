import {
  BoundaryScorePauseCutScorer,
  TagBonusCutScorer,
  type CutScorer,
  type TagConditionParser,
  GreedyLimitByCharsSegmentSplitter,
  OptimalLimitByCharsSegmentSplitter,
  type PauseBonusConfig,
  type SegmentSplitter,
} from '@tscaps/engine';
import type { ControlField, ControlValue } from '@core/templates/domain/definition/ControlField';
import type {
  SegmentSplitterContext,
  SegmentSplitterDescriptor,
  SegmentSplitterDisplay,
} from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import type { OptimalLimitByCharsSegmentConfig } from '@core/segment-splitter/domain/SegmentSplitterConfig';

/**
 * Character-limit splitter that chooses every cut of a segment together,
 * rating each cut by the word's `boundaryScore` and the silence after
 * it. A segment no split can keep within both bounds is split one cut
 * at a time instead, by the same ratings.
 */
export class OptimalLimitByCharsSegmentSplitterDescriptor
  implements SegmentSplitterDescriptor<OptimalLimitByCharsSegmentConfig>
{
  readonly type = 'optimal_limit_by_chars' as const;

  readonly defaultConfig: OptimalLimitByCharsSegmentConfig = {
    type: 'optimal_limit_by_chars',
    maxChars: 40,
    minChars: 0,
    pauseWeight: 0.5,
    minPause: 0.2,
    maxPause: 1,
    cutCost: 0.4,
  };

  readonly controlsSchema: readonly ControlField[] = [
    { id: 'minChars', label: 'Min letters', type: 'integer', default: 0, min: 0, max: 60 },
    { id: 'maxChars', label: 'Max letters', type: 'integer', default: 40, min: 1, max: 120 },
  ];

  constructor(private readonly tagConditionParser: TagConditionParser) {}

  build(config: OptimalLimitByCharsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitter {
    const bounds = { maxChars: config.maxChars, minChars: config.minChars };
    const cutScorer = this.cutScorer(config);
    return new OptimalLimitByCharsSegmentSplitter(
      { ...bounds, cutCost: config.cutCost },
      cutScorer,
      new GreedyLimitByCharsSegmentSplitter(bounds, cutScorer),
    );
  }

  /** The silence and boundary scorer, with a bonus after a tagged word when the config names a tag. */
  private cutScorer(config: OptimalLimitByCharsSegmentConfig): CutScorer {
    const scorer = new BoundaryScorePauseCutScorer(this.pauseBonus(config));
    if (config.cutAfterTag === undefined) return scorer;
    return new TagBonusCutScorer(scorer, this.tagConditionParser.parse(config.cutAfterTag), config.cutAfterTagWeight ?? 1);
  }

  private pauseBonus(config: OptimalLimitByCharsSegmentConfig): PauseBonusConfig | null {
    if (config.pauseWeight <= 0) return null;
    return { weight: config.pauseWeight, minPause: config.minPause, maxPause: config.maxPause };
  }

  toDisplay(config: OptimalLimitByCharsSegmentConfig, _context: SegmentSplitterContext): SegmentSplitterDisplay {
    return {
      fields: this.controlsSchema,
      values: config as unknown as Record<string, ControlValue>,
    };
  }

  fromDisplay(
    fieldId: string,
    displayValue: ControlValue,
    _context: SegmentSplitterContext,
  ): Partial<OptimalLimitByCharsSegmentConfig> {
    return { [fieldId]: displayValue } as Partial<OptimalLimitByCharsSegmentConfig>;
  }
}
