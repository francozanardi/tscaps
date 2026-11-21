import type { FootageStyle } from '@modules/video/FootageStyle';
import type { FootageClockUseInspector } from '@modules/video/stage/FootageClockUseInspector';
import type { FootageLayerClock } from '@modules/video/stage/FootageLayerClock';
import type { FootageLayerClockFactory } from '@modules/video/stage/FootageLayerClockFactory';
import { SeekingFootageLayerClock } from '@modules/video/stage/SeekingFootageLayerClock';
import { VariableFootageLayerClock } from '@modules/video/stage/VariableFootageLayerClock';

/**
 * Picks the clock by what the stylesheet does with it: one that reads
 * the clock only to time its animations is set by moving them
 * ({@link SeekingFootageLayerClock}), which costs the document far less
 * a moment; any other has the clock written for it every moment
 * ({@link VariableFootageLayerClock}). Either way a box resolves to the
 * same style.
 */
export class CssFootageLayerClockFactory implements FootageLayerClockFactory {
  constructor(private readonly clockUse: FootageClockUseInspector) {}

  open(style: FootageStyle): FootageLayerClock {
    const variables = new VariableFootageLayerClock();
    return this.clockUse.readsClockOnlyToTimeAnimations(style.css) ? new SeekingFootageLayerClock(variables) : variables;
  }
}
