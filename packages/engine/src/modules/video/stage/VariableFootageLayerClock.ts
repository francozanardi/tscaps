import { CssVariable } from '@modules/document/CssVariable';
import type { FootageLayer } from '@modules/video/FootageLayer';
import type { FootageLayerClock, FootageLayerClockChange } from '@modules/video/stage/FootageLayerClock';

// The clock is written to the tenth of a millisecond: finer than any
// frame, coarse enough that two asks of one moment write one value.
const CLOCK_DIGITS = 4;

/**
 * {@link FootageLayerClock} that writes the moment on the box as the
 * clock's custom properties (`CssVariable.LAYER_STARTS`, `LAYER_ENDS`:
 * each event minus the moment, in seconds; `LAYER_DURATION`), for the
 * stylesheet to read wherever it wants.
 *
 * It holds for any stylesheet, and it is the costly way: a custom
 * property changed on a box has the document work out the whole of the
 * box's style again, and nothing says whether it came out the same, so
 * every setting counts as a move.
 */
export class VariableFootageLayerClock implements FootageLayerClock {
  set(box: HTMLElement, layer: FootageLayer, outputSec: number): FootageLayerClockChange {
    box.style.setProperty(CssVariable.LAYER_STARTS, this.seconds(layer.outputStartSec - outputSec));
    box.style.setProperty(CssVariable.LAYER_ENDS, this.seconds(layer.outputEndSec - outputSec));
    box.style.setProperty(CssVariable.LAYER_DURATION, this.seconds(layer.outputEndSec - layer.outputStartSec));
    return 'moved';
  }

  private seconds(value: number): string {
    return `${value.toFixed(CLOCK_DIGITS)}s`;
  }
}
