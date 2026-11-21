import { describe, expect, it } from 'vitest';
import { MarkdownAgentHelpArticleParser } from '@core/help/infrastructure/MarkdownAgentHelpArticleParser';

const parser = new MarkdownAgentHelpArticleParser();

describe('MarkdownAgentHelpArticleParser', () => {
  it('reads the front matter lists and keeps the body as written', () => {
    const file = parser.parse('cuts', [
      '---',
      'title: Cut the video',
      'keywords: trim, dead air ,pauses',
      'labels: Remove silences',
      'covers: apps/studio/src/ui/pages/editor/features/timeline',
      '---',
      'Intro.',
      '',
      '## Remove the silences',
      'Steps.',
    ].join('\n'));

    expect(file.article).toEqual({ id: 'cuts', title: 'Cut the video', keywords: ['trim', 'dead air', 'pauses'], body: 'Intro.\n\n## Remove the silences\nSteps.' });
    expect(file.labels).toEqual(['Remove silences']);
    expect(file.covers).toEqual(['apps/studio/src/ui/pages/editor/features/timeline']);
    expect(file.problems).toEqual([]);
  });

  it('reads the article without the lines that mark what only one build ships', () => {
    const file = parser.parse('cuts', [
      '---',
      'title: Cut the video',
      '---',
      'Click **Cut**.',
      '<!-- @close-begin -->',
      'Ask for it.',
      '<!-- @close-end -->',
      '',
      'More.',
    ].join('\n'));

    expect(file.article.body).toBe('Click **Cut**.\nAsk for it.\n\nMore.');
    expect(file.problems).toEqual([]);
  });

  it('still yields an article from a file with mistakes, and names each one', () => {
    const file = parser.parse('cuts', '---\ntitel: Cut\n---\nBody.');

    expect(file.article.title).toBe('cuts');
    expect(file.article.body).toBe('Body.');
    expect(file.problems).toEqual(['unknown front matter field: titel', 'no title']);
  });

  it('takes a file with no front matter as all body', () => {
    const file = parser.parse('cuts', 'Just text.');

    expect(file.article.body).toBe('Just text.');
    expect(file.problems).toContain('no front matter');
  });
});
