import type { AgentHelpArticle } from '@core/help/domain/AgentHelpArticle';

/**
 * A help article as its file holds it: the article, and the fields only
 * the corpus checks read: `labels` are words of the editor's interface
 * the article names, and `covers` the paths of the code it describes,
 * relative to the app. Neither reaches the model.
 */
export interface AgentHelpArticleFile {
  readonly article: AgentHelpArticle;
  readonly labels: ReadonlyArray<string>;
  readonly covers: ReadonlyArray<string>;
  /** What is wrong with the file, for the corpus checks; empty when nothing. */
  readonly problems: ReadonlyArray<string>;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
// A line that marks a part of the article only one build ships (the strip reads it); the article is read without it.
const BUILD_DIRECTIVE_LINE = /^[ \t]*<!--\s*@(?:close|oss)-(?:begin|end)\s*-->[ \t]*\r?\n?/gm;
const KNOWN_FIELDS = new Set(['title', 'keywords', 'labels', 'covers']);

/**
 * Reads a help article written as markdown under a front matter of
 * `key: value` lines (`title`, and comma-separated `keywords`, `labels`,
 * `covers`). Lines that mark what only one build ships
 * (`<!-- @close-begin -->`) are left out of what it reads.
 *
 * Lenient on purpose: a file with a mistake still yields an article (its
 * id stands in for a missing title), and the mistake is reported in
 * `problems`, so a slip in one article never takes the assistant down.
 */
export class MarkdownAgentHelpArticleParser {
  parse(id: string, file: string): AgentHelpArticleFile {
    const text = file.replace(BUILD_DIRECTIVE_LINE, '');
    const problems: string[] = [];
    const match = FRONT_MATTER.exec(text);
    if (match === null) problems.push('no front matter');
    const fields = this.fieldsOf(match?.[1] ?? '', problems);
    const body = (match === null ? text : text.slice(match[0].length)).trim();
    const title = fields.get('title') ?? '';
    if (title === '') problems.push('no title');
    if (body === '') problems.push('no body');
    return {
      article: { id, title: title === '' ? id : title, keywords: this.listOf(fields.get('keywords')), body },
      labels: this.listOf(fields.get('labels')),
      covers: this.listOf(fields.get('covers')),
      problems,
    };
  }

  private fieldsOf(frontMatter: string, problems: string[]): Map<string, string> {
    const fields = new Map<string, string>();
    for (const line of frontMatter.split(/\r?\n/)) {
      if (line.trim() === '') continue;
      const colon = line.indexOf(':');
      if (colon <= 0) {
        problems.push(`unreadable front matter line: ${line}`);
        continue;
      }
      const key = line.slice(0, colon).trim();
      if (!KNOWN_FIELDS.has(key)) problems.push(`unknown front matter field: ${key}`);
      fields.set(key, line.slice(colon + 1).trim());
    }
    return fields;
  }

  private listOf(value: string | undefined): string[] {
    if (value === undefined) return [];
    return value.split(',').map((item) => item.trim()).filter((item) => item !== '');
  }
}
