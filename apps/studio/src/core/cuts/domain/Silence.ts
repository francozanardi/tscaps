import type { CutRange } from '@core/cuts/domain/CutRegistry';

/**
 * A silent stretch of the source video that qualifies for removal,
 * already shrunk by the project's gap padding so the contained
 * `range` can be committed as a cut verbatim. `isInterSentence` is
 * true when the silence sits at or around a segment boundary (or at a
 * video edge) — i.e. a pause between sentences rather than a pause
 * inside a sentence. Consumers can use the flag to apply different
 * length thresholds to the two cases.
 */
export interface Silence {
  readonly range: CutRange;
  readonly isInterSentence: boolean;
}
