import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';
import type { AgentHelpSource } from '@core/help/domain/AgentHelpSource';
import type { MarkdownAgentHelpArticleParser } from '@core/help/infrastructure/MarkdownAgentHelpArticleParser';

// Each article is a markdown file named for its id, bundled with the app; an article only one build ships is named
// `<id>.close.md` and left out of the other.
const ARTICLE_FILES = import.meta.glob('../articles/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

/** The help written by hand, as it ships: markdown files bundled with the app, read once. */
export class BundledAgentHelpSource implements AgentHelpSource {
  private readonly bundled: ReadonlyArray<AgentHelpArticle>;

  constructor(parser: MarkdownAgentHelpArticleParser) {
    this.bundled = Object.entries(ARTICLE_FILES)
      .map(([path, text]) => parser.parse(this.idOf(path), text))
      .map((file) => file.article)
      .sort((first, second) => first.id.localeCompare(second.id));
  }

  articles(): ReadonlyArray<AgentHelpArticle> {
    return this.bundled;
  }

  /** The file name without its extension: `export.md` answers to `export`, and `batches.close.md` to `batches`. */
  private idOf(path: string): string {
    const file = path.slice(path.lastIndexOf('/') + 1);
    return file.replace(/(\.close)?\.md$/, '');
  }
}
