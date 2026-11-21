import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicParamValue, GraphicStage } from '@core/graphics/domain/GraphicStage';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';

/** The rate a graphic's clock steps at: the time asked is rounded to the nearest of its frames. */
const GRAPHIC_FPS = 30;
// A frame whose size is not known yet is taken as square, as the stage takes it.
const UNKNOWN_FRAME_SIDE_PX = 1000;
// The smallest box a graphic is drawn in, so a box squeezed to nothing still draws.
const MIN_BOX_SIDE_PX = 16;

/**
 * The stage a graphic layer is played on: the one place its box, its
 * clock and its randomness are decided, so everything that plays it
 * plays the same thing.
 *
 * The graphic is drawn at the size of its box on the frame, never
 * stretched: the box its layout gives it, on a frame of the video's size.
 * It shows for as long as its stretch lasts, its clock stepping at a
 * fixed rate; its randomness starts from its layer's id, so it draws the
 * same thing every time; its fields hold the values set, or their
 * defaults.
 */
export class ShotGraphicStageBuilder {
  constructor(private readonly boxes: ShotLayerBoxShape) {}

  /** The stage of `layer`, laid out by `placement` on `frame` (null while its size is not known), over `stretch`. */
  build(layer: ShotGraphicLayer, stretch: ShotLayerStretch, placement: ShotLayerPlacement, frame: VideoLayout | null): GraphicStage {
    const box = this.boxOf(placement, frame, layer.graphic.aspectRatio);
    return {
      widthPx: box.widthPx,
      heightPx: box.heightPx,
      fps: GRAPHIC_FPS,
      seed: this.seedOf(layer.id),
      durationSec: Number.isFinite(stretch.outputEndSec) ? stretch.outputEndSec - stretch.outputStartSec : 0,
      params: this.paramsOf(layer.graphic),
    };
  }

  /** The size in pixels of the box `placement` lays the graphic out in, on a frame of the video's size. */
  private boxOf(placement: ShotLayerPlacement, frame: VideoLayout | null, aspectRatio: number): { widthPx: number; heightPx: number } {
    const frameWidth = frame !== null && frame.width > 0 ? frame.width : UNKNOWN_FRAME_SIDE_PX;
    const frameHeight = frame !== null && frame.height > 0 ? frame.height : UNKNOWN_FRAME_SIDE_PX;
    const shape = this.boxes.aspectRatioOf(placement, frameWidth / frameHeight, aspectRatio) ?? aspectRatio;
    const width = this.widthOf(placement, frameWidth, frameHeight, shape);
    return { widthPx: Math.max(MIN_BOX_SIDE_PX, Math.round(width)), heightPx: Math.max(MIN_BOX_SIDE_PX, Math.round(width / shape)) };
  }

  /** The box's width before it is fitted to the frame's edges: as wide as asked, never wider or taller than the frame. */
  private widthOf(placement: ShotLayerPlacement, frameWidth: number, frameHeight: number, shape: number): number {
    const shorterSide = Math.min(frameWidth, frameHeight);
    switch (placement.kind) {
      case 'full':
        return frameWidth;
      case 'inset':
        if (placement.subject === 'video') return frameWidth;
        return Math.min(placement.width * frameWidth, frameHeight * shape);
      case 'split': {
        const gap = 2 * placement.padding * shorterSide;
        return frameWidth > frameHeight ? placement.assetRatio * frameWidth - gap : frameWidth - gap;
      }
    }
  }

  /** Every field's value: the one set, or the field's default. */
  private paramsOf(graphic: Graphic): Record<string, GraphicParamValue> {
    return Object.fromEntries(graphic.fields.map((field) => [field.id, graphic.params[field.id] ?? field.defaultValue]));
  }

  /** A number from `layerId` (FNV-1a), so a layer's randomness is its own and the same every time. */
  private seedOf(layerId: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < layerId.length; index += 1) {
      hash ^= layerId.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }
}
