import type { ShortcutsModule } from '@bootstrap/wiring/shortcuts';
import type { AgentHelpSource } from '@core/help/domain/AgentHelpSource';
import { BundledAgentHelpSource } from '@core/help/infrastructure/BundledAgentHelpSource';
import { MarkdownAgentHelpArticleParser } from '@core/help/infrastructure/MarkdownAgentHelpArticleParser';
import { AgentHelpLibrary } from '@core/help/services/AgentHelpLibrary';
import { AgentHelpTokenizer } from '@core/help/services/AgentHelpTokenizer';
import { ShortcutsAgentHelpSource } from '@core/help/services/ShortcutsAgentHelpSource';

/**
 * The editor's help: the articles bundled with the app, the keyboard
 * shortcuts in force (the person's own changes included), and any
 * `extra` source the caller adds.
 */
export function bootHelpLibrary(shortcuts: ShortcutsModule, extra: ReadonlyArray<AgentHelpSource> = []): AgentHelpLibrary {
  return new AgentHelpLibrary(
    [
      new BundledAgentHelpSource(new MarkdownAgentHelpArticleParser()),
      ...extra,
      new ShortcutsAgentHelpSource(shortcuts.services.catalog, shortcuts.store),
    ],
    new AgentHelpTokenizer(),
  );
}
