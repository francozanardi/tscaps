import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { ColorGradeLooks } from '@core/color-grade/domain/ColorGradeLook';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { VideoCompositionTelemetryDescriber } from '@core/export/services/VideoCompositionTelemetryDescriber';
import type { Graphic } from '@core/graphics/domain/Graphic';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { GraphicTelemetryDescriber } from '@core/graphics/services/GraphicTelemetryDescriber';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';

/**
 * An export says what the video carries besides its captions, in counts
 * and stable ids: never a file's name or id, never a graphic's code or a
 * saved preset's name.
 */

const presets = new BuiltinGraphicPresetCatalog();
const layouts = new TestShotLayerLayouts().writer;

function asset(id: string, type: MediaAssetType): MediaAsset {
  return {
    id,
    type,
    owner: { kind: 'project', projectId: 'p' },
    fileName: `private-${id}.bin`,
    mimeType: 'application/octet-stream',
    sizeBytes: 10,
    widthPx: type === 'audio' ? null : 100,
    heightPx: type === 'audio' ? null : 100,
    durationSec: null,
  };
}

function describerOver(assets: readonly MediaAsset[]): VideoCompositionTelemetryDescriber {
  const store = new MediaAssetStore();
  store.replace(assets);
  return new VideoCompositionTelemetryDescriber(store, new GraphicTelemetryDescriber(presets, presets), new ColorGradeLooks());
}

function effect(id: string, source: Record<string, unknown>, anchor: Record<string, unknown>): Record<string, unknown> {
  return {
    id,
    role: 'effect',
    source,
    start: { anchor, offsetSec: 0 },
    end: null,
    inSec: 0,
    loop: false,
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    ducking: { enabled: false, depthDb: -12 },
  };
}

const untouched = {
  shots: ShotPartition.empty(),
  audio: AudioMix.empty(),
  outputFrame: OutputFrame.original(),
  colorGrade: ColorGrade.neutral(),
};

describe('VideoCompositionTelemetryDescriber', () => {
  it('describes a video the Video mode never touched as carrying nothing', () => {
    expect(describerOver([]).describe(untouched)).toMatchObject({
      shot_count: 0,
      shots_edited: false,
      layer_broll_count: 0,
      graphic_count: 0,
      shot_transition_kinds: [],
      camera_presets: [],
      output_format: 'original',
      output_fit: null,
      color_grade_look: 'none',
      sound_effect_count: 0,
      has_music: false,
      music_source: null,
      source_volume_changed: false,
      media_files_used: 0,
    });
  });

  it('counts layers by the type of their file and by their layout, a missing file apart', () => {
    let shots = ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'a', startSec: 0, layers: [
          { id: 'roll', mediaId: 'clip', inSec: 0, outSec: null, loop: false },
          { id: 'still', mediaId: 'photo', inSec: 0, outSec: null, loop: false },
        ] },
        { id: 'b', startSec: 4, transition: { kind: 'whip', durationSec: 0.4 }, layers: [
          { id: 'loop', mediaId: 'gif', inSec: 0, outSec: null, loop: false },
          { id: 'gone', mediaId: 'deleted', inSec: 0, outSec: null, loop: false },
        ] },
      ],
    });
    shots = shots.withLayerStyles(layouts.written(shots.layerStyles, 'roll', {
      kind: 'split', assetSide: 'end', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover',
    }));
    shots = shots.withLayerStyles(shots.layerStyles.withAnimation(
      'still', 'layer', ElementAnimationScope.ENTRANCE, { presetId: 'layer-fade-entrance', params: {} }, '',
    ));
    shots = shots.withLayerStyles(shots.layerStyles.withAnimation(
      ShotVideoLayerId.of('b'), 'layer', ElementAnimationScope.CAMERA, { presetId: 'layer-crash-zoom-camera', params: {} }, '',
    ));

    const properties = describerOver([asset('clip', 'video'), asset('photo', 'image'), asset('gif', 'gif')])
      .describe({ ...untouched, shots });

    expect(properties).toMatchObject({
      shot_count: 2,
      shots_edited: true,
      max_shot_sec: 4,
      layer_broll_count: 1,
      layer_picture_count: 1,
      layer_gif_count: 1,
      layer_missing_count: 1,
      layer_split_count: 1,
      layer_full_count: 3,
      layer_motion_count: 1,
      shot_transition_count: 1,
      shot_transition_kinds: ['whip'],
      camera_count: 1,
      camera_presets: ['layer-crash-zoom-camera'],
      media_files_used: 4,
    });
    expect(JSON.stringify(properties)).not.toContain('private-');
  });

  it('names a graphic by the shipped preset it came from, and says when its code was changed', () => {
    const starter = presets.starter();
    const edited: Graphic = { ...starter.graphic, document: { ...starter.graphic.document, js: '/* mine */' } };
    const custom: Graphic = { ...starter.graphic, presetId: null, document: { ...starter.graphic.document, html: '<p>mine</p>' } };
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [
        { id: 'a', startSec: 0, layers: [{ id: 'g1', graphic: starter.graphic }, { id: 'g2', graphic: edited }] },
        { id: 'b', startSec: 4, layers: [{ id: 'g3', graphic: { ...custom, hidesCaptions: true } }] },
      ],
    });

    const properties = describerOver([]).describe({ ...untouched, shots });

    expect(properties).toMatchObject({
      graphic_count: 3,
      graphic_presets: ['custom', starter.id].sort(),
      graphic_code_edited_count: 1,
      graphic_hides_captions_count: 1,
    });
    expect(JSON.stringify(properties)).not.toContain('mine');
  });

  it('describes the frame, the grade and the sounds by what was picked', () => {
    const audio = AudioMix.fromSnapshot({
      sourceVolume: 0.5,
      clips: [
        effect('pop', { kind: 'builtin', soundId: 'pop-bloop' }, { kind: 'word', wordId: 'w1', edge: 'start' }),
        effect('own', { kind: 'media', mediaId: 'sfx' }, { kind: 'transition', shotId: 'b' }),
        { ...effect('song', { kind: 'media', mediaId: 'track' }, { kind: 'video', edge: 'start' }), role: 'music', ducking: { enabled: true, depthDb: -12 } },
      ],
    });
    const frame = OutputFrame.fromSnapshot({ format: '9:16', fit: 'fill', backdrop: 'blur', position: { x: 0.2, y: 0.5 } });
    const warm = new ColorGradeLooks().list().find((look) => look.id === 'warm')!.grade;

    expect(describerOver([]).describe({ shots: ShotPartition.empty(), audio, outputFrame: frame, colorGrade: warm })).toMatchObject({
      output_format: '9:16',
      output_fit: 'fill',
      output_backdrop: null,
      output_crop_moved: true,
      color_grade_look: 'warm',
      sound_effect_count: 2,
      sound_effect_anchors: ['transition', 'word'],
      sound_builtin_count: 1,
      sound_file_count: 1,
      has_music: true,
      music_source: 'file',
      music_ducking: true,
      source_volume_changed: true,
      media_files_used: 2,
    });
  });

  it('calls a grade moved off every look custom', () => {
    const graded = ColorGrade.fromSnapshot({ exposure: 0.123 });

    expect(describerOver([]).describe({ ...untouched, colorGrade: graded })['color_grade_look']).toBe('custom');
  });
});
