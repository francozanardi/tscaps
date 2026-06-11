import type { Document } from '@modules/document/Document';

/**
 * A document-transforming pipeline stage. Effects are pure and
 * self-contained: each takes the current Document and returns a new one
 * with its transformation applied. They run after the splitter/tagger
 * stages, so they see the final structure of segments, lines, and words.
 *
 * Implementations are configured via constructor parameters; the engine
 * holds no notion of how those parameters might be serialized or surfaced
 * in a UI — that translation lives in the consumer (e.g. a web app's
 * registry of descriptors).
 */
export interface Effect {
  apply(document: Document): Document;
}
