import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { OutsideOperationWording } from '@core/automation/services/OutsideOperationWording';
import type { EditorOperationCatalog } from '@core/editor-operations/services/EditorOperationCatalog';

/** `list_operations`: every operation of the catalog with its description as an outside agent reads it, its effect and input schema. */
export class ListOperationsMethod implements AutomationMethod {
  readonly name = 'list_operations';

  constructor(
    private readonly catalog: EditorOperationCatalog,
    private readonly wording: OutsideOperationWording,
  ) {}

  async run(): Promise<unknown> {
    return this.catalog.list().map((operation) => ({
      name: operation.name,
      description: this.wording.of(operation.name, operation.description),
      effect: operation.effect,
      inputSchema: operation.inputSchema,
    }));
  }
}
