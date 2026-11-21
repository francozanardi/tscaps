import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { BUILTIN_SOUND_PACK } from '@core/audio-mix/infrastructure/BuiltinSoundPack';
import { StaticFileBuiltinSoundCatalog } from '@core/audio-mix/infrastructure/StaticFileBuiltinSoundCatalog';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import { CustomGraphicPresetReader } from '@core/editor-operations/services/CustomGraphicPresetReader';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { GraphicDocumentCheck } from '@core/editor-operations/services/GraphicDocumentCheck';
import { GraphicFontFamilyCheck } from '@core/editor-operations/services/GraphicFontFamilyCheck';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import { GraphicFieldsCheck } from '@core/editor-operations/services/GraphicFieldsCheck';
import { GraphicFillCheck } from '@core/editor-operations/services/GraphicFillCheck';
import { GraphicPlaybackCheck } from '@core/editor-operations/services/GraphicPlaybackCheck';
import { GraphicTextCheck } from '@core/editor-operations/services/GraphicTextCheck';
import { ShotRefResolver, type ProjectShot } from '@core/editor-operations/services/ShotRefResolver';
import { ScriptedGraphicLayerChecker } from '@core/editor-operations/testing/ScriptedGraphicLayerChecker';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { TransitionSoundShotLayoutFollower } from '@core/shot-transitions/services/TransitionSoundShotLayoutFollower';
import { AddShotGraphicAction } from '@core/shots/actions/AddShotGraphicAction';
import { SetShotLayerThroughAction } from '@core/shots/actions/SetShotLayerThroughAction';
import { LayerRunWriter } from '@core/editor-operations/services/LayerRunWriter';
import { LayerTransitionWriter } from '@core/editor-operations/services/LayerTransitionWriter';
import { SetShotLayerTransitionAction } from '@core/shot-transitions/actions/SetShotLayerTransitionAction';
import { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import { JoinShotAction } from '@core/shots/actions/JoinShotAction';
import { PatchShotLayersAction } from '@core/shots/actions/PatchShotLayersAction';
import { RemoveShotLayersAction } from '@core/shots/actions/RemoveShotLayersAction';
import { SetShotGraphicAction } from '@core/shots/actions/SetShotGraphicAction';
import { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';
import { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import { GraphicBoxPlacement } from '@core/shots/domain/GraphicBoxPlacement';
import type { Graphic } from '@core/graphics/domain/Graphic';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';
import { ShotGraphicPresetMotion } from '@core/shots/services/ShotGraphicPresetMotion';
import { ShotElementSounds } from '@core/shots/services/ShotElementSounds';
import { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';
import { ShotGraphicPresetSounds } from '@core/shots/services/ShotGraphicPresetSounds';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerPatcher } from '@core/shots/services/ShotLayerPatcher';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';

/** The shot actions the operations under test wrap, built as the app builds them. */
export interface ShotOperationsFixtureActions {
  readonly split: SplitShotAction;
  readonly join: JoinShotAction;
  readonly showFile: ShowFileOnShotAction;
  readonly patchLayers: PatchShotLayersAction;
  readonly setLayerPlacement: SetShotLayerPlacementAction;
  readonly removeLayers: RemoveShotLayersAction;
  readonly addGraphic: AddShotGraphicAction;
  readonly setGraphic: SetShotGraphicAction;
  readonly setCamera: SetShotCameraAction;
}

const PLAYS_EVERYTHING = { ensurePlayable: async (): Promise<void> => undefined };
const VIDEO_DURATION_SEC = 24;

/**
 * An editor holding a 24 s video with a sentence every 2 s, which the
 * shots are proposed from, and everything the shot, layer and graphic
 * operations run against, built the way the app builds it: the store,
 * the shot actions, the media list and the graphics' checks. Files go
 * into the media list as each test needs them; a GIF plays unless the
 * probe given says otherwise.
 */
export class ShotOperationsFixture {
  readonly store = this.editorWithSpeech();
  readonly media = new MediaAssetStore();
  readonly telemetry = new RecordingShotTelemetry();
  readonly parser = new EditorRefParser();
  readonly materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  readonly shotRefs = new ShotRefResolver(this.store, this.materializer, this.parser);
  readonly layerRuns = new LayerRunWriter(this.store, this.shotRefs, this.parser, new SetShotLayerThroughAction(this.store));
  readonly wordOpenings = new ShotWordOpeningResolver(new OriginalCaptionTrackReader(), new PictureChangeLocator(), new ShotOpeningPlacer());
  readonly graphicPresets = new BuiltinGraphicPresetCatalog();
  readonly sounds = new StaticFileBuiltinSoundCatalog(BUILTIN_SOUND_PACK, '/');
  readonly animations = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
  readonly fieldsCheck = new GraphicFieldsCheck(new GraphicSanitizer());
  readonly documentCheck = new GraphicDocumentCheck(new CssWriteGate(), new GraphicFontFamilyCheck(FONT_FAMILIES));
  readonly graphicChecker = new ScriptedGraphicLayerChecker();
  readonly graphicFill = new GraphicFillCheck(this.graphicChecker);
  readonly playback = new GraphicPlaybackCheck(this.store, this.graphicChecker, this.graphicFill, new GraphicTextCheck());
  readonly layerPatcher = new ShotLayerPatcher(new ShotLayerPlacementSanitizer());
  readonly customGraphics = new CustomGraphicPresetReader(new GraphicSanitizer(), this.fieldsCheck, this.documentCheck, this.animations, this.sounds);
  private readonly layouts = new TestShotLayerLayouts();
  /** Writes motion and camera presets into a layer's CSS, as the app does. */
  readonly animationWriter = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(this.animations, new ElementTimingVariableResolver(), this.layouts.controls));
  readonly actions: ShotOperationsFixtureActions;
  /** Sets a split's or a box's transitions at a layer's ends, with their sounds, as the Layout tab does. */
  readonly layerTransitions: LayerTransitionWriter;

  constructor(gifPlayback: GifPlaybackProbe = PLAYS_EVERYTHING) {
    this.actions = this.actionsFor(gifPlayback);
    this.layerTransitions = this.layerTransitionWriter();
  }

  /** Puts a file in the media list; a video runs `durationSec`. */
  addFile(id: string, type: MediaAssetType, durationSec = 5): void {
    this.media.put({
      id,
      type,
      owner: { kind: 'library' },
      fileName: `${id}.file`,
      mimeType: '',
      sizeBytes: 1,
      widthPx: type === 'audio' ? null : 100,
      heightPx: type === 'audio' ? null : 100,
      durationSec: type === 'video' || type === 'audio' ? durationSec : null,
    });
  }

  /** The shot at `index`, proposed or real, as the operations read it. */
  shot(index: number): ProjectShot {
    const shot = this.shotRefs.shots()[index];
    if (shot === undefined) throw new Error(`The fixture has no shot ${index}.`);
    return shot;
  }

  /** The graphic the layer `layerId` shows, or null where it shows none. */
  graphicOf(layerId: string): Graphic | null {
    const layer = this.store.snapshot().shots.findLayer(layerId);
    return layer !== null && 'graphic' in layer ? layer.graphic : null;
  }

  private editorWithSpeech(): EditorStore {
    const store = new EditorStore();
    const segments = Array.from({ length: 12 }, (_, index) => new Segment({
      id: `s${index}`,
      lines: [new Line({ words: [new Word({ text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
    }));
    store.patch({
      document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
      video: { ...store.snapshot().video, duration: VIDEO_DURATION_SEC },
    });
    return store;
  }

  private layerTransitionWriter(): LayerTransitionWriter {
    const splitTransitions = new ShotLayerSplitTransitions();
    const insetTransitions = new ShotLayerInsetTransitions();
    const splits = new SetShotLayerSplitTransitionAction(this.store, this.layouts.catalog, this.layouts.controls, splitTransitions);
    const insets = new SetShotLayerInsetTransitionAction(this.store, this.layouts.catalog, this.layouts.controls, insetTransitions);
    const picks = new SetShotLayerTransitionAction(
      this.store, splits, insets, splitTransitions, insetTransitions, new LayerTransitionSoundSuggestions(), new AudioClipDefaults(), this.telemetry.edits,
    );
    return new LayerTransitionWriter(picks, splits, insets);
  }

  private actionsFor(gifPlayback: GifPlaybackProbe): ShotOperationsFixtureActions {
    const layouts = this.layouts;
    const assets = new ShotLayerAssetReader();
    // Every file's bytes are its id, enough for a GIF to be probed.
    const bytes = { load: async (mediaId: string) => new Blob([mediaId]) } as unknown as MediaAssetBytesRepository;
    const preparer = new MediaAssetPreparer(bytes, {} as PreviewProxyGenerator, new DeviceOnlyMediaAssetUploader(), gifPlayback, PLAYS_EVERYTHING);
    const follower = new TransitionSoundShotLayoutFollower(
      new ShotLayerSplitTransitions(),
      new ShotLayerInsetTransitions(),
      new LayerTransitionSoundSuggestions(),
      new AudioClipDefaults(),
    );
    const lastEdited = new LastEditedPlacementRecorder(this.media, assets);
    const animationWriter = this.animationWriter;
    const presetSounds = new ShotGraphicPresetSounds(new AudioClipDefaults(), new ShotElementSounds());
    const presetMotion = new ShotGraphicPresetMotion(this.animations, animationWriter);
    const presetApplier = new ShotGraphicPresetApplier(layouts.writer, new GraphicBoxPlacement(), presetSounds, presetMotion);
    return {
      split: new SplitShotAction(this.store, this.materializer, this.telemetry.edits),
      join: new JoinShotAction(this.store, this.materializer, this.telemetry.edits),
      showFile: new ShowFileOnShotAction(this.store, this.materializer, this.media, assets, new ShotFilePlaybackCheck(this.media, preparer), layouts.writer, follower, this.telemetry.edits),
      patchLayers: new PatchShotLayersAction(this.store, this.media, assets, this.layerPatcher, layouts.writer, lastEdited, follower, this.telemetry.layoutChanges, this.telemetry.edits),
      setLayerPlacement: new SetShotLayerPlacementAction(this.store, layouts.writer, lastEdited, follower, this.telemetry.layoutChanges, this.telemetry.edits),
      removeLayers: new RemoveShotLayersAction(this.store, this.media, this.telemetry.edits),
      addGraphic: new AddShotGraphicAction(this.store, this.materializer, presetApplier, this.telemetry.graphics),
      setGraphic: new SetShotGraphicAction(this.store, presetApplier, this.telemetry.graphics),
      setCamera: new SetShotCameraAction(
        this.store, this.materializer, layouts.catalog, layouts.controls, this.animations, animationWriter, new ShotCameraSounds(),
        new AudioClipDefaults(), this.media, assets, new ShotLayerBoxShape(), this.telemetry.edits,
      ),
    };
  }
}
