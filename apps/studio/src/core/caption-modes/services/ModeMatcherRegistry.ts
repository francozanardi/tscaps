import type { TagConditionParser } from '@tscaps/engine';
import type { ModeMatcher } from '@core/caption-modes/domain/ModeMatcher';
import type { ModeMatcherConfig } from '@core/caption-modes/domain/ModeMatcherConfig';
import type { ModeMatcherDescriptor } from '@core/caption-modes/domain/ModeMatcherDescriptor';
import { TagConditionModeMatcherDescriptor } from '@core/caption-modes/services/matchers/TagConditionModeMatcherDescriptor';

/**
 * Every kind of mode matcher a template may name. A new kind is a
 * descriptor registered here: words picked by character count, by how
 * long they are said, or by anything else read off the words.
 */
export class ModeMatcherRegistry {
  private readonly byType = new Map<string, ModeMatcherDescriptor>();

  constructor(tagConditionParser: TagConditionParser) {
    this.register(new TagConditionModeMatcherDescriptor(tagConditionParser));
  }

  /** The matcher `config` names. Throws, saying what is wrong, when it names no kind or is malformed. */
  build(config: ModeMatcherConfig): ModeMatcher {
    const descriptor = this.byType.get(config.type);
    if (!descriptor) {
      throw new Error(`Unknown mode matcher "${config.type}". Name one of: ${[...this.byType.keys()].join(', ')}.`);
    }
    return descriptor.build(config);
  }

  private register(descriptor: ModeMatcherDescriptor): void {
    this.byType.set(descriptor.type, descriptor);
  }
}
