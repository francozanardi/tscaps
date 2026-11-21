import type { Graphic } from '@core/graphics/domain/Graphic';

/**
 * How far a layer shows. It always opens where the shot holding it
 * opens, and ends with that shot unless `throughShotId` names a later
 * one, in which case it shows over every shot from its own to that one,
 * that one included. Moving a shot's boundary therefore needs no change
 * here.
 */
interface ShotLayerRun {
  /**
   * The last shot the layer shows on, where that is a shot after the
   * one holding it; absent for a layer that ends with its own shot. A
   * partition never holds one naming anything else.
   */
  readonly throughShotId?: string;
}

/**
 * A file drawn on the frame: a b-roll, or a picture or a GIF on top —
 * what it is used for is decided from the file's type, not here.
 *
 * A video runs for the shorter of the stretch picked here and the
 * shots it shows on — or loops, where asked, when the stretch is the
 * shorter; a still asset ignores the stretch and spans those shots.
 *
 * `mediaId` names the asset; its bytes, its length and its size live
 * with it.
 */
export interface ShotFileLayer extends ShotLayerRun {
  readonly id: string;
  readonly mediaId: string;
  /** Where in the asset playback starts. */
  readonly inSec: number;
  /** Where in the asset playback stops, or null for its own end. */
  readonly outSec: number | null;
  readonly loop: boolean;
}

/**
 * A graphic drawn on the frame, above every file layer and below the
 * captions. It spans the shots it shows on; its document is held here,
 * not in the media library.
 */
export interface ShotGraphicLayer extends ShotLayerRun {
  readonly id: string;
  readonly graphic: Graphic;
}

/**
 * What a shot draws on the frame: a file, or a graphic.
 *
 * `id` is minted once and survives every gesture on the partition; it
 * is also the id the layer's style is kept under, where it sits, how it
 * looks and how it moves being CSS like any other element's
 * (`ShotPartition.layerStyles`).
 */
export type ShotLayer = ShotFileLayer | ShotGraphicLayer;
