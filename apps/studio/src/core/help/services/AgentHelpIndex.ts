import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';
import type { AgentHelpTokenizer } from '@core/help/services/AgentHelpTokenizer';

/** One section of an article that answered a search, best first. */
export interface AgentHelpHit {
  readonly articleId: string;
  readonly articleTitle: string;
  /** The section's heading, or the article's title for the text before its first heading. */
  readonly heading: string;
  readonly text: string;
  readonly score: number;
}

interface IndexedSection {
  readonly articleId: string;
  readonly articleTitle: string;
  readonly heading: string;
  readonly text: string;
  readonly termWeights: ReadonlyMap<string, number>;
  readonly length: number;
}

// A word in a title, a heading or a keyword says more about what a
// section is for than the same word in its text.
const TITLE_WEIGHT = 3;
const HEADING_WEIGHT = 3;
const KEYWORD_WEIGHT = 2;
const TEXT_WEIGHT = 1;
// BM25's usual constants: how fast repeating a word stops counting, and
// how much a long section is held against its matches.
const SATURATION = 1.2;
const LENGTH_NORMALISATION = 0.75;

/**
 * A keyword search over help articles, ranked with BM25: each `##`
 * section of an article is a document, and a word counts for more in a
 * section's title, heading or the article's keywords than in its text.
 * Built once over a fixed set of articles; cheap enough to build per
 * search for a help corpus of a few hundred sections.
 */
export class AgentHelpIndex {
  private readonly sections: ReadonlyArray<IndexedSection>;
  private readonly documentFrequency = new Map<string, number>();
  private readonly averageLength: number;

  constructor(
    articles: ReadonlyArray<AgentHelpArticle>,
    private readonly tokenizer: AgentHelpTokenizer,
  ) {
    this.sections = articles.flatMap((article) => this.sectionsOf(article));
    for (const section of this.sections) {
      for (const term of section.termWeights.keys()) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      }
    }
    const totalLength = this.sections.reduce((sum, section) => sum + section.length, 0);
    this.averageLength = this.sections.length === 0 ? 0 : totalLength / this.sections.length;
  }

  /**
   * The sections that match `query`, best first, at most `limit` of them
   * and at most `perArticle` from any one article, so a broad question
   * reaches several articles rather than every section of one. A section
   * matching no word of the query is never answered.
   */
  search(query: string, limit: number, perArticle: number): AgentHelpHit[] {
    const queryTerms = [...new Set(this.tokenizer.terms(query))];
    if (queryTerms.length === 0) return [];
    const scored = this.sections
      .map((section) => ({ section, score: this.scoreOf(section, queryTerms) }))
      .filter((entry) => entry.score > 0)
      .sort((first, second) => second.score - first.score);
    const hits: AgentHelpHit[] = [];
    const perArticleCount = new Map<string, number>();
    for (const { section, score } of scored) {
      const count = perArticleCount.get(section.articleId) ?? 0;
      if (count >= perArticle) continue;
      perArticleCount.set(section.articleId, count + 1);
      hits.push({ articleId: section.articleId, articleTitle: section.articleTitle, heading: section.heading, text: section.text, score });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  private scoreOf(section: IndexedSection, queryTerms: ReadonlyArray<string>): number {
    let score = 0;
    for (const term of queryTerms) {
      const weight = section.termWeights.get(term);
      if (weight === undefined) continue;
      const frequency = this.documentFrequency.get(term) ?? 0;
      const rarity = Math.log(1 + (this.sections.length - frequency + 0.5) / (frequency + 0.5));
      const lengthFactor = 1 - LENGTH_NORMALISATION + LENGTH_NORMALISATION * (section.length / this.averageLength);
      score += rarity * ((weight * (SATURATION + 1)) / (weight + SATURATION * lengthFactor));
    }
    return score;
  }

  private sectionsOf(article: AgentHelpArticle): IndexedSection[] {
    const [lead = '', ...headed] = article.body.split(/^## +/m);
    const sections: IndexedSection[] = [];
    if (lead.trim() !== '') sections.push(this.indexed(article, article.title, lead.trim()));
    for (const part of headed) {
      const newline = part.indexOf('\n');
      const heading = newline === -1 ? part : part.slice(0, newline);
      const text = newline === -1 ? '' : part.slice(newline + 1);
      sections.push(this.indexed(article, heading.trim(), text.trim()));
    }
    return sections;
  }

  private indexed(article: AgentHelpArticle, heading: string, text: string): IndexedSection {
    const termWeights = new Map<string, number>();
    const add = (source: string, weight: number) => {
      for (const term of this.tokenizer.terms(source)) termWeights.set(term, (termWeights.get(term) ?? 0) + weight);
    };
    add(article.title, TITLE_WEIGHT);
    add(heading, HEADING_WEIGHT);
    add(article.keywords.join(' '), KEYWORD_WEIGHT);
    add(text, TEXT_WEIGHT);
    let length = 0;
    for (const weight of termWeights.values()) length += weight;
    return { articleId: article.id, articleTitle: article.title, heading, text, termWeights, length };
  }
}
