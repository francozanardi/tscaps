import type { TagConditionParser } from '@tscaps/engine';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';

/**
 * Checks the sounds a template plays on its words. The loader keeps what
 * it can of a sound written wrong — a sound this build does not carry
 * plays nothing, an out-of-range volume is brought into range — so each
 * of those slips would ship as a template quieter than its author meant.
 * This is where they are refused instead.
 */
export class SoundsTemplateJsonContractRule implements TemplateJsonContractRule {

  constructor(
    private readonly sounds: BuiltinSoundCatalog,
    private readonly tagConditionParser: TagConditionParser,
  ) {}

  check(templateJson: unknown): ContractViolation[] {
    const declared = this.soundsOf(templateJson);
    if (declared === undefined) return [];
    if (!Array.isArray(declared)) return [{ message: '"sounds" must be a list.' }];
    return declared.flatMap((entry, index) => this.violationsOf(entry, index));
  }

  private violationsOf(entry: unknown, index: number): ContractViolation[] {
    if (entry === null || typeof entry !== 'object') return [{ message: `sounds[${index}] must be an object.` }];
    const sound = entry as Record<string, unknown>;
    return [
      ...this.soundViolations(sound['sound'], index),
      ...this.whenViolations(sound['when'], index),
      ...this.rangeViolations(sound['volume'], 'volume', 0, 1, index),
      ...this.rangeViolations(sound['offset'], 'offset', -10, 10, index),
      ...this.rangeViolations(sound['minGap'], 'minGap', 0, 10, index),
    ];
  }

  private soundViolations(soundId: unknown, index: number): ContractViolation[] {
    if (typeof soundId === 'string' && this.sounds.find(soundId) !== null) return [];
    const known = this.sounds.list().map((sound) => sound.id).join(', ');
    return [{ message: `sounds[${index}].sound names no bundled sound. Name one of: ${known}.` }];
  }

  private whenViolations(when: unknown, index: number): ContractViolation[] {
    if (typeof when !== 'string' || when.trim() === '') {
      return [{ message: `sounds[${index}].when must be a tag expression, such as "peak or hook".` }];
    }
    try {
      this.tagConditionParser.parse(when);
      return [];
    } catch (error) {
      return [{ message: `sounds[${index}].when does not parse: ${error instanceof Error ? error.message : String(error)}` }];
    }
  }

  private rangeViolations(value: unknown, field: string, min: number, max: number, index: number): ContractViolation[] {
    if (value === undefined) return [];
    if (typeof value === 'number' && value >= min && value <= max) return [];
    return [{ message: `sounds[${index}].${field} must be a number from ${min} to ${max}.` }];
  }

  private soundsOf(templateJson: unknown): unknown {
    if (templateJson === null || typeof templateJson !== 'object') return undefined;
    return (templateJson as Record<string, unknown>)['sounds'];
  }
}
