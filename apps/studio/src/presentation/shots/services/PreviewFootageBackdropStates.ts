import { RenderTimeMap } from '@tscaps/engine';
import { type FootageLayerFrameState } from '@tscaps/engine/advanced';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import type { PictureBackdropStates } from '@presentation/person-segmentation/PictureBackdropStates';

/**
 * {@link PictureBackdropStates} read off the footage the preview draws:
 * the backdrop layers its resolver answers for the output time a source
 * time plays at, through the same resolver the preview composes with.
 */
export class PreviewFootageBackdropStates implements PictureBackdropStates {
  constructor(
    private readonly footage: ShotLayerPreviewFootageStore,
    private readonly store: EditorStore,
  ) {}

  statesAt(sourceSec: number): ReadonlyArray<FootageLayerFrameState> {
    const footage = this.footage.snapshot();
    if (footage === null || !footage.layers.some((layer) => layer.source.kind === 'backdrop')) return [];
    const outputSec = new RenderTimeMap(this.store.snapshot().cuts.list()).toOutputTime(sourceSec);
    return footage.resolver.resolveAt(outputSec)
      .filter(({ layer }) => layer.source.kind === 'backdrop')
      .map(({ state }) => state);
  }
}
