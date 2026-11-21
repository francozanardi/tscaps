import type { TagConditionParser } from '@tscaps/engine';
import type { ModeMatcher } from '@core/caption-modes/domain/ModeMatcher';
import type { ModeMatcherConfig, TagConditionModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';
import type { ModeMatcherDescriptor } from '@core/caption-modes/domain/ModeMatcherDescriptor';
import { TagConditionModeMatcher } from '@core/caption-modes/services/matchers/TagConditionModeMatcher';

export class TagConditionModeMatcherDescriptor implements ModeMatcherDescriptor {
  readonly type = 'tag-condition' as const;

  constructor(private readonly tagConditionParser: TagConditionParser) {}

  build(config: ModeMatcherConfig): ModeMatcher {
    const condition = (config as Partial<TagConditionModeMatcherConfig>).condition;
    if (typeof condition !== 'string' || condition.trim() === '') {
      throw new Error('A "tag-condition" matcher needs a "condition", a tag expression such as "hook or peak".');
    }
    return new TagConditionModeMatcher(this.tagConditionParser.parse(condition));
  }
}
