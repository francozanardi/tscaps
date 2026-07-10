import type { Document, Effect } from '@tscaps/engine';

/**
 * `Effect` implementation that returns its input document unchanged.
 * Used to satisfy the descriptor contract for effect configs whose
 * real behaviour lives at render time rather than at document
 * derivation time, so the pipeline can iterate uniformly without
 * special-casing them.
 */
export class PassthroughEffect implements Effect {
  apply(document: Document): Document {
    return document;
  }
}
