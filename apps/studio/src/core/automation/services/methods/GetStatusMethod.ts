import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import type { EditorStatusReader } from '@core/automation/services/EditorStatusReader';

/** `get_status`: whether a project is open and ready, its video, and the error the editor shows. */
export class GetStatusMethod implements AutomationMethod {
  readonly name = 'get_status';

  constructor(private readonly status: EditorStatusReader) {}

  async run(): Promise<unknown> {
    return this.status.read();
  }
}
