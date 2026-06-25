import { RenderTimeMap } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';

/**
 * Wraps a CutRegistry into a RenderTimeMap suitable for translating
 * between source video time (the `<video>` element's `currentTime`,
 * the times stored on every Word) and output time (what the user
 * sees once cuts collapse the timeline).
 */
export class RenderTimeMapBuilder {
  build(cuts: CutRegistry): RenderTimeMap {
    return new RenderTimeMap(cuts.list());
  }
}
