import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import { AudioMixTelemetryReporter } from '@core/audio-mix/services/AudioMixTelemetryReporter';
import { SuggestedSoundMatcher } from '@core/audio-mix/services/SuggestedSoundMatcher';
import { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { AddAudioClipAction } from '@core/audio-mix/actions/AddAudioClipAction';
import { AddAudioClipsAction } from '@core/audio-mix/actions/AddAudioClipsAction';
import { PatchAudioClipsAction } from '@core/audio-mix/actions/PatchAudioClipsAction';
import { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import { SetSourceVolumeAction } from '@core/audio-mix/actions/SetSourceVolumeAction';
import { SetFootageSoundAction } from '@core/audio-mix/actions/SetFootageSoundAction';
import { SetShotVideoVolumeAction } from '@core/audio-mix/actions/SetShotVideoVolumeAction';
import { UseAsMusicAction } from '@core/audio-mix/actions/UseAsMusicAction';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { AudioAnchorTiming } from '@core/audio-mix/services/AudioAnchorTiming';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { AudioMixLayerBuilder } from '@core/audio-mix/services/AudioMixLayerBuilder';
import { FootageSoundReader } from '@core/audio-mix/services/FootageSoundReader';
import { FootageSoundAvailability } from '@core/audio-mix/services/FootageSoundAvailability';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { WebAudioSoundAuditionOutput } from '@core/audio-mix/infrastructure/WebAudioSoundAuditionOutput';
import { SpeechSpanReader } from '@core/audio-mix/services/SpeechSpanReader';
import { RenderAudioMixBuilder } from '@core/audio-mix/services/RenderAudioMixBuilder';
import { AudioMixExportContributor } from '@core/audio-mix/services/AudioMixExportContributor';
import { MediaLibraryAudioSourceFiles } from '@core/audio-mix/infrastructure/MediaLibraryAudioSourceFiles';
import { HeldAudioSourceFiles } from '@core/audio-mix/services/HeldAudioSourceFiles';
import { AudioMixPreviewStore } from '@core/audio-mix/store/AudioMixPreviewStore';
import { AudioMixPreviewAutomation } from '@core/audio-mix/automations/AudioMixPreviewAutomation';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { AudioPlaybackProbe } from '@core/media/domain/AudioPlaybackProbe';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import type { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

export interface AudioMixDependencies {
  readonly store: EditorStore;
  /** When shot layers show, which a clip anchored to a layer's entry or exit follows, and a layer's own sound plays. */
  readonly layerTiming: ShotLayerTiming;
  /** Makes the proposed shots real when a clip is anchored to one of them. */
  readonly shotPartitions: ShotPartitionMaterializer;
  /** Where the words a clip anchored to a word follows are read: the Original track's, whatever track is active. */
  readonly originalCaptions: OriginalCaptionTrackReader;
  /** Path the app is served under, trailing slash included; the bundled sounds are served beneath it. */
  readonly appBaseUrl: string;
  /** Where a media file's bytes are read, as it was added. */
  readonly mediaBytes: MediaAssetBytesRepository;
  /** Whether this browser can decode a sound file. */
  readonly audioPlayback: AudioPlaybackProbe;
  /** The media files the project can use, whose lengths clips are placed by. */
  readonly mediaAssets: MediaAssetStore;
  /** Where the preview plays the soundtrack. */
  readonly previewSurface: VideoPreviewSurface;
  readonly telemetry: Telemetry;
}

export type AudioMixModule = ReturnType<typeof bootAudioMix>;

/**
 * Boots the project's soundtrack: the actions that add, change and
 * remove its clips, set the video's own level, overall and per shot,
 * and hear a shot layer's own sound; what reads the mix
 * against the edit — where each anchor lands on the output, where
 * somebody speaks, and the layers that are heard; the bundled sounds a
 * clip can play; where a sound is heard before it is placed; what
 * turns the heard layers into the engine's, with their files read, for
 * the export; and what keeps the preview playing them, from files held
 * in memory once read, published in the preview store.
 */
export function bootAudioMix(deps: AudioMixDependencies) {
  const timing = new AudioAnchorTiming(
    deps.layerTiming,
    new ShotLayerSplitTransitions(),
    new ShotLayerInsetTransitions(),
    new ShotTransitionCuts(),
    new DecorationFilter(new DecorationVisibility()),
  );
  const speech = new SpeechSpanReader();
  const layerBuilder = new AudioMixLayerBuilder(timing, speech, new FootageSoundReader(deps.layerTiming));
  const builtinSounds = new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, deps.appBaseUrl);
  const reporter = new AudioMixTelemetryReporter(
    deps.telemetry,
    new TelemetryBudget(deps.store),
    builtinSounds,
    new SuggestedSoundMatcher(
      new ShotTransitionSoundSuggestions(),
      new ShotCameraSounds(),
      new LayerTransitionSoundSuggestions(),
      new ShotLayerSplitTransitions(),
      new ShotLayerInsetTransitions(),
    ),
  );
  const sourceFiles = new MediaLibraryAudioSourceFiles(deps.mediaBytes, builtinSounds, deps.audioPlayback, reporter);
  const renderMixBuilder = new RenderAudioMixBuilder();
  const heldFiles = new HeldAudioSourceFiles(sourceFiles);
  const preview = new AudioMixPreviewStore();
  const defaults = new AudioClipDefaults();
  return {
    services: {
      timing,
      speech,
      layerBuilder,
      originalCaptions: deps.originalCaptions,
      builtinSounds,
      sourceFiles,
      heldFiles,
      footageSounds: new FootageSoundAvailability(sourceFiles),
      renderMixBuilder,
      auditionOutput: new WebAudioSoundAuditionOutput(),
    },
    preview,
    previewAutomation: new AudioMixPreviewAutomation(
      deps.store,
      deps.previewSurface,
      layerBuilder,
      renderMixBuilder,
      heldFiles,
      deps.originalCaptions,
      builtinSounds,
      deps.mediaAssets,
      preview,
    ),
    exportContributor: new AudioMixExportContributor(layerBuilder, renderMixBuilder, sourceFiles, builtinSounds),
    actions: {
      addClip: new AddAudioClipAction(deps.store, defaults),
      addClips: new AddAudioClipsAction(deps.store, defaults, deps.shotPartitions, reporter),
      patchClips: new PatchAudioClipsAction(deps.store, reporter),
      removeClips: new RemoveAudioClipsAction(deps.store, reporter),
      setSourceVolume: new SetSourceVolumeAction(deps.store),
      setFootageSound: new SetFootageSoundAction(deps.store),
      setShotVideoVolume: new SetShotVideoVolumeAction(deps.store, deps.shotPartitions),
      useAsMusic: new UseAsMusicAction(deps.store, defaults, reporter),
    },
  };
}
