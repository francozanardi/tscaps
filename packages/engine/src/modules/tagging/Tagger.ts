import type { Document } from '@modules/document/index';

// Applies tags to elements of the Document.
// Returns a new Document with tags applied (immutable transform).
export abstract class Tagger {
  abstract tag(document: Document): Document;
}
