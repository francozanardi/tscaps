import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';
import type { AgentHelpSource } from '@core/help/domain/AgentHelpSource';
import { AgentHelpIndex, type AgentHelpHit } from '@core/help/services/AgentHelpIndex';
import type { AgentHelpTokenizer } from '@core/help/services/AgentHelpTokenizer';

/**
 * Every help article the assistant can read, gathered from its sources
 * at the moment it asks, so an article written from live state (the
 * person's own keyboard shortcuts) answers what is true now. When two
 * sources hold the same id, the earlier source's article is kept.
 */
export class AgentHelpLibrary {
  constructor(
    private readonly sources: ReadonlyArray<AgentHelpSource>,
    private readonly tokenizer: AgentHelpTokenizer,
  ) {}

  articles(): AgentHelpArticle[] {
    const byId = new Map<string, AgentHelpArticle>();
    for (const source of this.sources) {
      for (const article of source.articles()) {
        if (!byId.has(article.id)) byId.set(article.id, article);
      }
    }
    return [...byId.values()];
  }

  /** The article `id`, or null when there is none. */
  article(id: string): AgentHelpArticle | null {
    return this.articles().find((article) => article.id === id) ?? null;
  }

  /** The best sections for `query`; see `AgentHelpIndex.search`. */
  search(query: string, limit: number, perArticle: number): AgentHelpHit[] {
    return new AgentHelpIndex(this.articles(), this.tokenizer).search(query, limit, perArticle);
  }
}
