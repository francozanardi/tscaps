import type { FootageLayer } from '@tscaps/engine';
import type { ScheduledListedShotLayer } from '@core/shots/domain/ScheduledShotLayer';
import type { StagedShotLayer } from '@core/shots/services/ShotLayerStageBuilder';

/** A shot layer as the engine plays it, and as the stage resolving how it is drawn holds it. */
export interface BuiltShotLayer {
  readonly footage: FootageLayer;
  readonly staged: StagedShotLayer;
}

/**
 * Turns a scheduled shot layer into what draws it: the engine's footage
 * layer — what it plays and when, from its stretch — and its box on the
 * stage, which carries its file's shape for its CSS to lay it out by.
 * The preview and the export both build their layers here, so they
 * cannot disagree.
 */
export class ShotFootageLayerBuilder {
  /** The layer drawing `source`, the layer's file; a graphic, which has none, is refused. */
  build(source: Blob, scheduled: ScheduledListedShotLayer): BuiltShotLayer {
    const kind = scheduled.asset.kind;
    if (kind === 'graphic') throw new Error('A graphic layer has no file to draw.');
    return {
      footage: { id: scheduled.layer.id, source: { kind, blob: source }, ...scheduled.stretch },
      staged: { layerId: scheduled.layer.id, assetAspectRatio: scheduled.asset.aspectRatio },
    };
  }
}
