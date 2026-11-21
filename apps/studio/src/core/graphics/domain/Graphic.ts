import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicField } from '@core/graphics/domain/GraphicField';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';

/**
 * A graphic as a project holds it: its document, the fields the document
 * declares, the values the user set on them, the shape of the box it is
 * made for, the moments its code said it has, and the preset it started
 * from, and whether it keeps the captions off its shot.
 *
 * `params` holds only values set; a field missing from it holds its
 * default. `aspectRatio` is the box's width over its height where the
 * layout leaves the shape to what it shows, as a picture's own shape is.
 * `moments` are what the code declared the last time it ran, in the order
 * they happen; they are kept with the graphic so a sound placed on one
 * lands without running the code.
 */
export interface Graphic {
  readonly document: GraphicDocument;
  readonly fields: ReadonlyArray<GraphicField>;
  readonly params: Readonly<Record<string, GraphicParamValue>>;
  readonly aspectRatio: number;
  readonly moments: ReadonlyArray<GraphicMoment>;
  /**
   * The id of the preset it started from, kept when its code is edited, so
   * a reset knows what to go back to; null for one that started from none.
   */
  readonly presetId: string | null;
  /**
   * Whether the captions are kept off the screen for the graphic's whole
   * shot: what a hook asks for, since it carries the opening line itself.
   */
  readonly hidesCaptions: boolean;
}
