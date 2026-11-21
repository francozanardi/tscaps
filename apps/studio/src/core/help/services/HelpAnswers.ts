import type { AgentHelpHit } from '@core/help/services/AgentHelpIndex';
import type { AgentHelpLibrary } from '@core/help/services/AgentHelpLibrary';

const MAX_SECTIONS = 4;
const MAX_SECTIONS_PER_ARTICLE = 2;

/** What the help answers: its text, and whether it found what was asked. */
export interface HelpAnswer {
  readonly text: string;
  readonly found: boolean;
}

/**
 * The help's answers as whoever asks reads them: the best matching
 * sections of a search, each under its article id, or one article whole.
 * What it does not find says what there is instead.
 */
export class HelpAnswers {
  constructor(private readonly library: AgentHelpLibrary) {}

  /** One article whole, by id. */
  article(id: string): HelpAnswer {
    const article = this.library.article(id);
    if (article === null) return { text: `No help article is called ${id}. ${this.contents()}`, found: false };
    return { text: `[${article.id}] ${article.title}\n\n${article.body}`, found: true };
  }

  /** The sections that match `query` best, a few at most, two of one article at most. */
  search(query: string): HelpAnswer {
    const hits = this.library.search(query, MAX_SECTIONS, MAX_SECTIONS_PER_ARTICLE);
    if (hits.length === 0) return { text: `Nothing in the help matches "${query}". Try other words, or read an article. ${this.contents()}`, found: false };
    const sections = hits.map((hit) => this.sectionOf(hit)).join('\n\n');
    return { text: `${sections}\n\nTo read a whole article, call search_help with its id as \`article\`.`, found: true };
  }

  private sectionOf(hit: AgentHelpHit): string {
    const heading = hit.heading === hit.articleTitle ? hit.articleTitle : `${hit.articleTitle} › ${hit.heading}`;
    return `[${hit.articleId}] ${heading}\n${hit.text}`;
  }

  private contents(): string {
    const articles = this.library.articles().map((article) => `${article.id} (${article.title})`);
    return `Articles: ${articles.join(', ')}.`;
  }
}
