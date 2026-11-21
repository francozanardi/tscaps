import type { FootagePictureProvider } from '@tscaps/engine';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import { GraphicFootagePictureProvider } from '@core/graphics/services/GraphicFootagePictureProvider';
import type { ShotGraphicMomentRecorder } from '@core/shots/domain/ShotGraphicMomentRecorder';
import type { ShotGraphicFailureRecorder } from '@core/shots/domain/ShotGraphicFailureRecorder';
import type { ShotLayerStretch } from '@core/shots/domain/ShotLayerStretch';
import type { ShotGraphicLayer } from '@core/shots/domain/ShotLayer';
import type { ShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import type { BuiltShotLayer } from '@core/shots/services/ShotFootageLayerBuilder';
import type { ShotGraphicStageBuilder } from '@core/shots/services/ShotGraphicStageBuilder';

/** What a graphic layer's pictures were made for, and who provides them. */
interface HeldProvider {
  readonly key: string;
  readonly provider: FootagePictureProvider;
}

/**
 * Turns a graphic layer into what draws it: the engine's footage layer,
 * whose pictures the graphic draws for each moment of its stretch, and
 * its box on the stage, in the shape the graphic is made for.
 *
 * The graphic is played on the stage `stages` gives it: at the size of
 * its box on the frame, never stretched, its clock counting from where
 * its stretch starts.
 *
 * A layer whose graphic, box and stretch have not changed keeps the
 * provider it was given, so whoever plays it can tell nothing changed and
 * keep playing it. What a graphic's code says goes to `messages`, under
 * its layer's id, starting over when its graphic does; the moments its
 * code declares go to `moments`, each time it opens. The preview and the
 * export both build their graphics here.
 */
export class ShotGraphicFootageBuilder {
  private readonly held = new Map<string, HeldProvider>();

  constructor(
    private readonly players: GraphicPlayerFactory,
    private readonly stages: ShotGraphicStageBuilder,
    private readonly messages: GraphicMessageLog,
    private readonly moments: ShotGraphicMomentRecorder,
    private readonly failures: ShotGraphicFailureRecorder,
  ) {}

  /** `layer`, laid out by `placement` on `frame`, over `stretch`. */
  build(layer: ShotGraphicLayer, stretch: ShotLayerStretch, placement: ShotLayerPlacement, frame: VideoLayout | null): BuiltShotLayer {
    const stage = this.stages.build(layer, stretch, placement, frame);
    return {
      footage: { id: layer.id, source: { kind: 'provided', provider: this.providerOf(layer, stage) }, ...stretch },
      staged: { layerId: layer.id, assetAspectRatio: layer.graphic.aspectRatio },
    };
  }

  private providerOf(layer: ShotGraphicLayer, stage: GraphicStage): FootagePictureProvider {
    const key = JSON.stringify([layer.graphic.document, stage]);
    const held = this.held.get(layer.id);
    if (held !== undefined && held.key === key) return held.provider;
    this.messages.restart(layer.id);
    const provider = new GraphicFootagePictureProvider(
      this.players,
      layer.graphic.document,
      stage,
      (message: GraphicMessage) => this.messages.record(layer.id, message),
      (moments) => this.moments.record(layer.id, layer.graphic, moments),
      (stage, error) => this.failures.record(layer.id, layer.graphic, stage, error),
    );
    this.held.set(layer.id, { key, provider });
    return provider;
  }
}
