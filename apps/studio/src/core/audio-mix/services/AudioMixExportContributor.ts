import { RenderTimeMap, type RenderAudioMix } from '@tscaps/engine';
import type {
  ExportRenderContext,
  ExportRenderContribution,
  ExportRenderContributor,
} from '@core/export/domain/ExportRenderContributor';
import type { AudioMixBuildContext } from '@core/audio-mix/domain/AudioMixBuildContext';
import type { AudioMixLayer } from '@core/audio-mix/domain/AudioMixLayer';
import type { AudioSourceFiles } from '@core/audio-mix/domain/AudioSourceFiles';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import { CatalogAudioSourceLengths } from '@core/audio-mix/infrastructure/CatalogAudioSourceLengths';
import type { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import type { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';

/**
 * Contributes the soundtrack to the render: every clip resolved against
 * the edit, as the preview resolves it, and mixed with the video's own
 * sound from the files as they were added.
 *
 * Waits for every file it needs, which on a device that has not got one
 * yet means waiting for it to come down — until the run is abandoned,
 * when it stops waiting and rejects with an `AbortError`. A file that
 * cannot be had, or that this browser cannot decode, is left out and
 * named, so the render can say it goes without it; a b-roll's own sound
 * that cannot be had is left out unnamed, the b-roll silent.
 *
 * Contributes no mix when nothing is heard over the video's own sound
 * and that sound is left at its level everywhere: the engine then
 * handles it exactly as it would without a soundtrack. A level other
 * than its own, overall or in a shot, is contributed alone when nothing else
 * is heard.
 */
export class AudioMixExportContributor implements ExportRenderContributor {
  constructor(
    private readonly layerBuilder: AudioMixLayerBuilder,
    private readonly renderMixBuilder: RenderAudioMixBuilder,
    private readonly files: AudioSourceFiles,
    private readonly builtinSounds: BuiltinSoundCatalog,
  ) {}

  async prepare(context: ExportRenderContext): Promise<ExportRenderContribution> {
    const resolved = this.layerBuilder.build(context.audio, this.buildContextOf(context));
    const { mix, unavailable } = await this.renderMixBuilder.build(resolved, this.files, context.signal);
    return {
      segmentClasses: new Map(),
      topLayer: null,
      elementsUnderTopLayer: new Set(),
      footage: null,
      unavailableFootage: [],
      audioMix: this.changesTheSound(mix) ? mix : null,
      unavailableAudio: this.clipSourcesAmong(unavailable, resolved.layers).map((source) => this.nameOf(source, context.media)),
      audioLayerFileNames: new Map(resolved.layers
        .filter((layer) => layer.kind === 'clip')
        .map((layer) => [layer.id, this.nameOf(layer.source, context.media)])),
    };
  }

  /**
   * The files of `sources` some clip plays. A b-roll's own sound that
   * cannot be had is left out unasked: its file most often holds no
   * sound at all, and a missing one is asked about as footage already.
   */
  private clipSourcesAmong(sources: ReadonlyArray<AudioSourceRef>, layers: ReadonlyArray<AudioMixLayer>): AudioSourceRef[] {
    const clipSources = layers.filter((layer) => layer.kind === 'clip').map((layer) => layer.source);
    return sources.filter((source) => clipSources.some((clipSource) => this.isSameSource(source, clipSource)));
  }

  private isSameSource(first: AudioSourceRef, second: AudioSourceRef): boolean {
    return first.kind === 'media'
      ? second.kind === 'media' && second.mediaId === first.mediaId
      : second.kind === 'builtin' && second.soundId === first.soundId;
  }

  /** Whether `mix` adds a layer, or moves the video's own sound off its level somewhere. */
  private changesTheSound(mix: RenderAudioMix): boolean {
    return mix.layers.length > 0 || mix.inputGain !== 1 || (mix.inputDucks ?? []).some((duck) => duck.ranges.length > 0);
  }

  private buildContextOf(context: ExportRenderContext): AudioMixBuildContext {
    return {
      originalDocument: context.originalDocument,
      originalSheets: context.originalSheets,
      originalDecorationOverrides: context.originalDecorationOverrides,
      shots: context.shots,
      media: context.media,
      timeMap: new RenderTimeMap(context.cuts.list()),
      videoDurationSec: context.videoDurationSec ?? 0,
      sourceLengths: new CatalogAudioSourceLengths(context.media, this.builtinSounds),
    };
  }

  private nameOf(source: AudioSourceRef, media: MediaAssetCatalog): string {
    if (source.kind === 'builtin') return this.builtinSounds.find(source.soundId)?.name || source.soundId;
    return media.get(source.mediaId)?.fileName || source.mediaId;
  }
}
