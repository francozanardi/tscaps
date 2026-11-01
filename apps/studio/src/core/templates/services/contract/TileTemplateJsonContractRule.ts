import type { TemplateJsonContractRule } from '@core/templates/domain/contract/TemplateJsonContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import { TAG_NAMES } from '@core/tagging/domain/TagName';

const KNOWN_WORD_FIELDS: ReadonlySet<string> = new Set(['text', 'tags', 'emoji', 'said']);

/**
 * Checks `tile`, when present: lines of words, each word with text, tags
 * from the platform's vocabulary, a string emoji, and at most one word
 * marked `said`. The failures it exists for are silent: the loader drops
 * a word it cannot read and a tag no template styles paints nothing, so
 * the tile would show less than its author wrote with nothing to say so.
 *
 * The words also have to say the template's name. Every card in the
 * gallery is its template's name in that template's look, and a tile
 * dresses the name — a tag that lights it, an emoji — rather than
 * replacing it with a caption of its own.
 */
export class TileTemplateJsonContractRule implements TemplateJsonContractRule {

  check(templateJson: unknown): ContractViolation[] {
    if (templateJson === null || typeof templateJson !== 'object') return [];
    const record = templateJson as Record<string, unknown>;
    if (!('tile' in record)) return [];
    const tile = record['tile'];
    const lines = tile !== null && typeof tile === 'object' ? (tile as Record<string, unknown>)['lines'] : undefined;
    if (!Array.isArray(lines) || lines.length === 0 || lines.some((line) => !Array.isArray(line) || line.length === 0)) {
      return [{ message: '"tile" must hold "lines": a list of lines, each a non-empty list of words.' }];
    }
    const words = (lines as unknown[][]).flat();
    const violations = words.flatMap((word, index) => this.checkWord(word, index));
    violations.push(...this.checkSaysName(words, record['name']));
    const said = words.filter((word) => this.isRecord(word) && word['said'] === true).length;
    if (said > 1) violations.push({ message: `"tile" marks ${said} words "said"; mark one, or none to rest after the last.` });
    return violations;
  }

  private checkSaysName(words: unknown[], name: unknown): ContractViolation[] {
    if (typeof name !== 'string') return [];
    const text = words
      .map((word) => (this.isRecord(word) && typeof word['text'] === 'string' ? word['text'].trim() : ''))
      .filter((wordText) => wordText !== '')
      .join(' ');
    if (text.toLowerCase() === name.trim().toLowerCase()) return [];
    return [{ message: `"tile" must say the template's name, "${name}", and says "${text}".` }];
  }

  private checkWord(word: unknown, index: number): ContractViolation[] {
    const where = `"tile" word ${index + 1}`;
    if (!this.isRecord(word)) return [{ message: `${where} must be an object with a "text".` }];
    const violations: ContractViolation[] = [];
    if (typeof word['text'] !== 'string' || word['text'].trim() === '') {
      violations.push({ message: `${where} needs a non-empty "text".` });
    }
    for (const key of Object.keys(word)) {
      if (!KNOWN_WORD_FIELDS.has(key)) violations.push({ message: `${where} field "${key}" is not part of the schema.` });
    }
    violations.push(...this.checkTags(word['tags'], where));
    if ('emoji' in word && (typeof word['emoji'] !== 'string' || word['emoji'] === '')) {
      violations.push({ message: `${where} "emoji" must be a non-empty string.` });
    }
    if ('said' in word && typeof word['said'] !== 'boolean') {
      violations.push({ message: `${where} "said" must be true or false.` });
    }
    return violations;
  }

  private checkTags(tags: unknown, where: string): ContractViolation[] {
    if (tags === undefined) return [];
    if (!Array.isArray(tags)) return [{ message: `${where} "tags" must be a list of tag names.` }];
    const known: ReadonlySet<string> = new Set(TAG_NAMES);
    return tags
      .filter((tag) => typeof tag !== 'string' || !known.has(tag))
      .map((tag) => ({ message: `${where} tag ${JSON.stringify(tag)} is not one of ${TAG_NAMES.join(', ')}.` }));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
