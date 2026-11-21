import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';

/**
 * Somewhere help articles come from: markdown bundled with the app, or
 * articles written at the moment they are asked for from what the app
 * itself knows (its keyboard shortcuts, its plans), so they cannot drift
 * from it. Read on every search, so a source may answer differently over
 * time.
 */
export interface AgentHelpSource {
  articles(): ReadonlyArray<AgentHelpArticle>;
}
