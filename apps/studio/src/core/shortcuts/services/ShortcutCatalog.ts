import type { ShortcutCategory } from '@core/shortcuts/domain/ShortcutCategory';
import type { ShortcutCommand } from '@core/shortcuts/domain/ShortcutCommand';
import type { ShortcutCommandId } from '@core/shortcuts/domain/ShortcutCommandId';

/**
 * The commands the app offers shortcuts for, looked up by id or listed
 * in their declared order.
 */
export class ShortcutCatalog {

  private readonly commandsById: ReadonlyMap<ShortcutCommandId, ShortcutCommand>;

  constructor(private readonly commands: readonly ShortcutCommand[]) {
    this.commandsById = new Map(commands.map((command) => [command.id, command]));
  }

  list(): readonly ShortcutCommand[] {
    return this.commands;
  }

  listCategory(category: ShortcutCategory): ShortcutCommand[] {
    return this.commands.filter((command) => command.category === category);
  }

  /** Throws for an id the catalog was not given: that is a wiring bug, never user input. */
  get(commandId: ShortcutCommandId): ShortcutCommand {
    const command = this.commandsById.get(commandId);
    if (!command) throw new Error(`Unknown shortcut command: ${commandId}`);
    return command;
  }
}
