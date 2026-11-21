import type { TelemetryEventProperties } from '@shared/telemetry';
import type { AudioMix } from '@core/audio-mix/domain/AudioMix';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import type { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import type { ShotFileLayer, ShotGraphicLayer, ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/** What is drawn and heard on top of the captions: the part of the editor state the Video mode edits. */
export interface VideoComposition {
  readonly shots: ShotPartition;
  readonly audio: AudioMix;
  readonly outputFrame: OutputFrame;
  readonly colorGrade: ColorGrade;
}

/**
 * Describes what a video carries besides its captions, as flat
 * properties for an export event: its shots and what they draw, the
 * frame it is cut to, its grade and its sounds.
 *
 * Counts and stable ids only. A file is described by its type, never by
 * its name or id; a graphic by the preset it came from, never by its
 * code or its text.
 */
export class VideoCompositionTelemetryDescriber {
  constructor(
    private readonly mediaAssets: MediaAssetStore,
    private readonly graphics: GraphicTelemetryDescriber,
    private readonly colorGradeLooks: ColorGradeLooks,
  ) {}

  describe(composition: VideoComposition): TelemetryEventProperties {
    return {
      ...this.shotProperties(composition.shots),
      ...this.fileLayerProperties(composition.shots),
      ...this.graphicProperties(composition.shots),
      ...this.frameProperties(composition.outputFrame),
      color_grade_look: this.colorGradeLooks.lookOf(composition.colorGrade)?.id ?? 'custom',
      ...this.soundProperties(composition.audio),
      media_files_used: new Set([...composition.shots.mediaIdsInUse(), ...composition.audio.mediaIdsInUse()]).size,
    };
  }

  private shotProperties(shots: ShotPartition): TelemetryEventProperties {
    const list = shots.list();
    const transitionKinds = list.flatMap((shot) => (shot.transition === undefined ? [] : [shot.transition.kind]));
    const cameraPresets = list.flatMap((shot) => {
      const presetId = shots.layerStyles.animationOf(ShotVideoLayerId.of(shot.id), ElementAnimationScope.CAMERA)?.presetId ?? null;
      return presetId === null ? [] : [presetId];
    });
    return {
      shot_count: list.length,
      shots_edited: !shots.isEmpty(),
      max_shot_sec: shots.budget().maxSec,
      shot_transition_count: transitionKinds.length,
      shot_transition_kinds: this.distinct(transitionKinds),
      camera_count: cameraPresets.length,
      camera_presets: this.distinct(cameraPresets),
      shot_video_styled: shots.hasStyledVideo(),
    };
  }

  private fileLayerProperties(shots: ShotPartition): TelemetryEventProperties {
    const layers = this.layersOf(shots).filter((layer): layer is ShotFileLayer => 'mediaId' in layer);
    const catalog = this.mediaAssets.snapshot();
    const typeOf = (layer: ShotFileLayer) => catalog.get(layer.mediaId)?.type ?? null;
    const kindOf = (layer: ShotFileLayer) => shots.placementOf(layer.id).kind;
    return {
      layer_broll_count: layers.filter((layer) => typeOf(layer) === 'video').length,
      layer_picture_count: layers.filter((layer) => typeOf(layer) === 'image').length,
      layer_gif_count: layers.filter((layer) => typeOf(layer) === 'gif').length,
      layer_missing_count: layers.filter((layer) => typeOf(layer) === null).length,
      layer_full_count: layers.filter((layer) => kindOf(layer) === 'full').length,
      layer_split_count: layers.filter((layer) => kindOf(layer) === 'split').length,
      layer_inset_count: layers.filter((layer) => kindOf(layer) === 'inset').length,
      layer_motion_count: this.layersOf(shots).filter((layer) => this.hasMotion(shots, layer)).length,
    };
  }

  private graphicProperties(shots: ShotPartition): TelemetryEventProperties {
    const graphics = this.layersOf(shots)
      .filter((layer): layer is ShotGraphicLayer => 'graphic' in layer)
      .map((layer) => layer.graphic);
    return {
      graphic_count: graphics.length,
      graphic_presets: this.distinct(graphics.map((graphic) => this.graphics.presetOf(graphic))),
      graphic_code_edited_count: graphics.filter((graphic) => this.graphics.isCodeEdited(graphic)).length,
      graphic_hides_captions_count: graphics.filter((graphic) => graphic.hidesCaptions).length,
    };
  }

  /** Fit and backdrop only say something once the frame is cut to another shape; null for the video's own. */
  private frameProperties(frame: OutputFrame): TelemetryEventProperties {
    const original = frame.isOriginal();
    return {
      output_format: frame.format,
      output_fit: original ? null : frame.fit,
      output_backdrop: original || frame.fit === 'fill' ? null : frame.backdrop,
      output_crop_moved: !original && frame.fit === 'fill' && (frame.position.x !== 0.5 || frame.position.y !== 0.5),
    };
  }

  private soundProperties(audio: AudioMix): TelemetryEventProperties {
    const effects = audio.clips().filter((clip) => clip.role === 'effect');
    const music = audio.clips().find((clip) => clip.role === 'music') ?? null;
    return {
      sound_effect_count: effects.length,
      sound_effect_anchors: this.distinct(effects.map((clip) => clip.start.anchor.kind)),
      sound_builtin_count: effects.filter((clip) => clip.source.kind === 'builtin').length,
      sound_file_count: effects.filter((clip) => clip.source.kind === 'media').length,
      footage_sound_count: audio.footageSounds().length,
      has_music: music !== null,
      music_source: music === null ? null : this.sourceKindOf(music),
      music_ducking: music === null ? null : music.ducking.enabled,
      source_volume_changed: audio.sourceVolume !== 1 || audio.hasShotVideoVolumes(),
    };
  }

  private sourceKindOf(clip: AudioClip): 'builtin' | 'file' {
    return clip.source.kind === 'builtin' ? 'builtin' : 'file';
  }

  private hasMotion(shots: ShotPartition, layer: ShotLayer): boolean {
    return [ElementAnimationScope.ENTRANCE, ElementAnimationScope.EXIT]
      .some((scope) => (shots.layerStyles.animationOf(layer.id, scope)?.presetId ?? null) !== null);
  }

  private layersOf(shots: ShotPartition): ShotLayer[] {
    return shots.list().flatMap((shot) => [...shot.layers]);
  }

  private distinct(values: readonly string[]): string[] {
    return [...new Set(values)].sort();
  }
}
