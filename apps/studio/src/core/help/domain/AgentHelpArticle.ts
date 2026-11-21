/**
 * One article of the app's help, as the assistant reads it to answer the
 * person's questions about the app itself (how to do something, what a
 * word means, what the app offers).
 *
 * `body` is markdown whose `##` headings split it into sections; a search
 * answers single sections, so each one stands on its own. `keywords` are
 * words a person might ask with that the text does not use.
 */
export interface AgentHelpArticle {
  /** Stable, lowercase, hyphenated; what the assistant names to read it whole. */
  readonly id: string;
  readonly title: string;
  readonly keywords: ReadonlyArray<string>;
  readonly body: string;
}
