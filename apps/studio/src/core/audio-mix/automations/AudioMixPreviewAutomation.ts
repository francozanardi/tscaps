import { RenderTimeMap } from '@tscaps/engine';
import type { AudioMixBuildContext } from '@core/audio-mix/domain/AudioMixBuildContext';
import type { ResolvedAudioMix } from '@core/audio-mix/domain/AudioMixLayer';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import { CatalogAudioSourceLengths } from '@core/audio-mix/infrastructure/CatalogAudioSourceLengths';
import type { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import type { HeldAudioSourceFiles } from '@core/audio-mix/services/HeldAudioSourceFiles';
import type { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import type { AudioMixPreview, AudioMixPreviewStore } from '@core/audio-mix/store/AudioMixPreviewStore';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewAudioMix } from '@core/preview/domain/PreviewAudioMix';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * Keeps the preview playing the project's soundtrack as the export mixes
 * it: each change of the mix, the Original track (its words, and the
 * sheets and emoji edits that decide which of its emojis show), the
 * shots, the cuts, the media catalog or the video's length resolves the
 * mix again,
 * through the same layer builder the export uses, and hands the surface
 * the layers heard with their files and the video's own level, with the
 * stretches where it is lowered. The
 * result is published in the preview store.
 *
 * Files are held in memory once read, so an edit that moves no clip's
 * file hands the surface the same files and nothing is opened again. A
 * clip whose file is still being read is left out until it lands; one
 * whose file cannot be had stays silent, as the export would leave it
 * out. A change in the media catalog tries those files again.
 */
export class AudioMixPreviewAutomation {
  private static readonly SILENT: PreviewAudioMix = {
    layers: [],
    inputGain: 1,
    inputDucks: [],
    outputDurationSec: Number.POSITIVE_INFINITY,
  };
  private static readonly NEVER_ABANDONED = new AbortController().signal;

  private lastState: EditorState | null = null;
  private build = 0;
  private unsubscribeFiles: (() => void) | null = null;

  constructor(
    private readonly store: EditorStore,
    private readonly surface: VideoPreviewSurface,
    private readonly layerBuilder: AudioMixLayerBuilder,
    private readonly renderMixBuilder: RenderAudioMixBuilder,
    private readonly files: HeldAudioSourceFiles,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly builtinSounds: BuiltinSoundCatalog,
    private readonly assets: MediaAssetStore,
    private readonly preview: AudioMixPreviewStore,
  ) {}

  start(): void {
    this.store.addEventListener('change', this.onStoreChange);
    this.assets.addEventListener('change', this.onCatalogChange);
    this.unsubscribeFiles = this.files.subscribe(this.refresh);
    this.refresh();
  }

  stop(): void {
    this.store.removeEventListener('change', this.onStoreChange);
    this.assets.removeEventListener('change', this.onCatalogChange);
    this.unsubscribeFiles?.();
    this.unsubscribeFiles = null;
    this.lastState = null;
    this.build++;
    this.files.retainOnly([]);
    this.surface.setAudioMix(AudioMixPreviewAutomation.SILENT);
    this.preview.set(null);
  }

  private readonly onStoreChange = (): void => {
    if (this.lastState && !this.mixInputsChanged(this.lastState, this.store.snapshot())) return;
    this.refresh();
  };

  private readonly onCatalogChange = (): void => {
    this.files.forgetUnavailable();
    this.refresh();
  };

  private readonly refresh = (): void => {
    const state = this.store.snapshot();
    this.lastState = state;
    const context = this.buildContextOf(state);
    const resolved = this.layerBuilder.build(state.audio, context);
    this.files.retainOnly(resolved.layers.map((layer) => layer.source));
    const build = ++this.build;
    void this.renderMixBuilder.build(resolved, this.files, AudioMixPreviewAutomation.NEVER_ABANDONED).then(({ mix }) => {
      if (build !== this.build) return;
      this.surface.setAudioMix({
        layers: mix.layers,
        inputGain: mix.inputGain,
        inputDucks: mix.inputDucks ?? [],
        outputDurationSec: this.outputDurationOf(context),
      });
      this.preview.set(this.previewOf(resolved));
    });
  };

  private buildContextOf(state: EditorState): AudioMixBuildContext {
    const media = this.assets.snapshot();
    const original = this.originalCaptions.read(state);
    return {
      originalDocument: original.document,
      originalSheets: original.sheets,
      originalDecorationOverrides: original.decorationOverrides,
      shots: state.shots,
      media,
      timeMap: new RenderTimeMap(state.cuts.list()),
      videoDurationSec: state.video.duration > 0 ? state.video.duration : 0,
      sourceLengths: new CatalogAudioSourceLengths(media, this.builtinSounds),
    };
  }

  private outputDurationOf(context: AudioMixBuildContext): number {
    return context.videoDurationSec > 0
      ? context.timeMap.toOutputTime(context.videoDurationSec)
      : Number.POSITIVE_INFINITY;
  }

  private previewOf(resolved: ResolvedAudioMix): AudioMixPreview {
    const sources = resolved.layers.map((layer) => layer.source);
    return {
      layers: resolved.layers.filter((layer) => this.files.statusOf(layer.source) === 'held'),
      unavailable: this.files.sourcesAt('unavailable', sources),
      reading: this.files.sourcesAt('reading', sources),
    };
  }

  private mixInputsChanged(previous: EditorState, next: EditorState): boolean {
    return previous.audio !== next.audio
      || previous.shots !== next.shots
      || previous.cuts !== next.cuts
      || previous.video.duration !== next.video.duration
      || previous.document !== next.document
      || previous.captionTracks !== next.captionTracks
      || previous.activeCaptionTrackId !== next.activeCaptionTrackId;
  }
}
