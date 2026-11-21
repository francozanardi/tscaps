import type { GraphicField, GraphicFieldKind } from '@core/graphics/domain/GraphicField';
import type { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';
import type { OperationProblem } from '@core/editor-operations/domain/OperationResult';

const COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

const WHAT_A_KIND_TAKES: Readonly<Record<GraphicFieldKind, string>> = {
  text: 'a text field takes a string',
  color: 'a color field takes "#rrggbb" or "#rrggbbaa"',
  number: 'a number field takes a number',
  image: 'an image field takes "" (none) or a data:image/(png|jpeg|webp|gif);base64 URL of at most 400000 characters',
  emoji: 'an emoji field takes one emoji, as a string',
};

/**
 * Checks the fields a graphic declares, and the values set on them, the
 * way the editor will hold them: each field's default and each value of
 * its field's kind, no two fields under one id, no value for a field the
 * graphic does not declare. The editor drops what fails these without a
 * word; this says what failed and how to write it.
 */
export class GraphicFieldsCheck {
  constructor(private readonly sanitizer: GraphicSanitizer) {}

  /** One error per field declared twice, and per default that is not of its field's kind. */
  fieldProblems(fields: ReadonlyArray<GraphicField>): OperationProblem[] {
    const problems: OperationProblem[] = [];
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      if (seen.has(field.id)) problems.push(this.error(`fields[${index}]: "${field.id}" is declared twice; each field needs an id of its own.`));
      seen.add(field.id);
      if (!this.holds(field, field.defaultValue)) {
        problems.push(this.error(`fields[${index}] ("${field.id}"): its defaultValue does not fit its kind; ${WHAT_A_KIND_TAKES[field.kind]}.`));
      }
    });
    return problems;
  }

  /** One error per value naming no field of `fields`, and per value that is not of its field's kind. */
  paramProblems(params: Readonly<Record<string, GraphicParamValue>>, fields: ReadonlyArray<GraphicField>): OperationProblem[] {
    const problems: OperationProblem[] = [];
    for (const [fieldId, value] of Object.entries(params)) {
      const field = fields.find((candidate) => candidate.id === fieldId);
      if (field === undefined) {
        problems.push(this.error(`params.${fieldId}: the graphic has no field "${fieldId}"; ${this.declared(fields)}.`));
      } else if (!this.holds(field, value)) {
        problems.push(this.error(`params.${fieldId}: ${WHAT_A_KIND_TAKES[field.kind]}.`));
      }
    }
    return problems;
  }

  /** Whether `field` can hold `value` as the editor keeps it. */
  holds(field: GraphicField, value: GraphicParamValue): boolean {
    switch (field.kind) {
      case 'text': return typeof value === 'string';
      case 'color': return typeof value === 'string' && COLOR.test(value);
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'image': return typeof value === 'string' && this.sanitizer.isImageValue(value);
      case 'emoji': return this.sanitizer.isEmojiValue(value);
    }
  }

  private declared(fields: ReadonlyArray<GraphicField>): string {
    return fields.length === 0 ? 'it declares no fields' : `its fields are ${fields.map((field) => field.id).join(', ')}`;
  }

  private error(message: string): OperationProblem {
    return { severity: 'error', message };
  }
}
