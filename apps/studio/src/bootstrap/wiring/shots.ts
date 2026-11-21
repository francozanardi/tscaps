import { TelemetryShotGraphicFailureRecorder } from '@core/shots/services/TelemetryShotGraphicFailureRecorder';
import { ErrorNameTelemetryDescriber } from '@core/errors/services/ErrorNameTelemetryDescriber';
import { TelemetryBudget } from '@core/telemetry/services/TelemetryBudget';
import { ShotEditTelemetryReporter } from '@core/shots/services/ShotEditTelemetryReporter';
import { ShotGraphicTelemetryReporter } from '@core/shots/services/ShotGraphicTelemetryReporter';
import { ShotLayerLayoutChangeReader } from '@core/shots/services/ShotLayerLayoutChangeReader';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import { CssFragmentParser, CssMinifier, type FootageLayerResolverFactory } from '@tscaps/engine/advanced';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { ShotResolver } from '@core/shots/services/ShotResolver';
import { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import { SplitShotBeforeWordAction } from '@core/shots/actions/SplitShotBeforeWordAction';
import { MoveShotStartToWordAction } from '@core/shots/actions/MoveShotStartToWordAction';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';
import { JoinShotAction } from '@core/shots/actions/JoinShotAction';
import { TransitionSoundShotLayoutFollower } from '@core/shot-transitions/services/TransitionSoundShotLayoutFollower';
import { SetShotLayerTransitionAction } from '@core/shot-transitions/actions/SetShotLayerTransitionAction';
import { LayerTransitionSoundSuggestions } from '@core/shot-transitions/domain/LayerTransitionSoundSuggestions';
import { SetShotTransitionAction } from '@core/shot-transitions/actions/SetShotTransitionAction';
import { ShotTransitionSoundSuggestions } from '@core/shot-transitions/domain/ShotTransitionSoundSuggestions';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { ShotTransitionLayerBuilder } from '@core/shots/services/ShotTransitionLayerBuilder';
import { ShotTransitionStyleWriter } from '@core/shots/services/ShotTransitionStyleWriter';
import { BUILTIN_SHOT_LAYER_STAGE_CSS } from '@core/shots/infrastructure/BuiltinShotLayerStageCss';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import { ReproposeShotsAction } from '@core/shots/actions/ReproposeShotsAction';
import { AddShotLayerAction } from '@core/shots/actions/AddShotLayerAction';
import { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';
import { ShowFileOnCurrentShotAction } from '@core/shots/actions/ShowFileOnCurrentShotAction';
import { RemoveShotLayersAction } from '@core/shots/actions/RemoveShotLayersAction';
import { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import { PatchShotLayersAction } from '@core/shots/actions/PatchShotLayersAction';
import { ReplaceShotLayerFileAction } from '@core/shots/actions/ReplaceShotLayerFileAction';
import { SetShotLayerThroughAction } from '@core/shots/actions/SetShotLayerThroughAction';
import { SetShotVideoThroughAction } from '@core/shots/actions/SetShotVideoThroughAction';
import { SetShotLayerTimingAction } from '@core/shots/actions/SetShotLayerTimingAction';
import { ShotLayerExportContributor } from '@core/shots/services/ShotLayerExportContributor';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerPatcher } from '@core/shots/services/ShotLayerPatcher';
import { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import { ShotLayerSplitTransitions } from '@core/shots/domain/ShotLayerSplitTransitions';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { ShotLayerLayoutFields } from '@core/shots/domain/ShotLayerLayoutFields';
import { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';
import { ShotFootageLayerBuilder } from '@core/shots/services/ShotFootageLayerBuilder';
import { ShotLayerStageBuilder } from '@core/shots/services/ShotLayerStageBuilder';
import { SetShotFollowAction } from '@core/shots/actions/SetShotFollowAction';
import { FollowPersonOnShotAction } from '@core/shots/actions/FollowPersonOnShotAction';
import type { PlanPersonFollowAction } from '@core/subject-tracking/actions/PlanPersonFollowAction';
import { ShotFollowCameraWriter } from '@core/shots/services/ShotFollowCameraWriter';
import { ShotFollowStager } from '@core/shots/services/ShotFollowStager';
import { ShotFollowCrop } from '@core/shots/services/ShotFollowCrop';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import { OutputFrameCss } from '@core/output-frame/services/OutputFrameCss';
import { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';
import { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { SetShotLayerSplitTransitionAction } from '@core/shots/actions/SetShotLayerSplitTransitionAction';
import { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { SetShotLayerCssAction } from '@core/shots/actions/SetShotLayerCssAction';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { ShotLayerCoverage } from '@core/shots/services/ShotLayerCoverage';
import { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';
import { ShotLayerPreviewAutomation } from '@core/shots/automations/ShotLayerPreviewAutomation';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import type { MediaAssetProxyCache } from '@core/media/services/MediaAssetProxyCache';
import type { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import { AddShotGraphicAction } from '@core/shots/actions/AddShotGraphicAction';
import { SetShotGraphicAction } from '@core/shots/actions/SetShotGraphicAction';
import { RecordShotGraphicMomentsAction } from '@core/shots/actions/RecordShotGraphicMomentsAction';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { GraphicBoxPlacement } from '@core/shots/domain/GraphicBoxPlacement';
import { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import { GraphicFilmstripRecorder } from '@core/graphics/services/GraphicFilmstripRecorder';
import { GraphicPresetThumbnailStore } from '@core/graphics/store/GraphicPresetThumbnailStore';
import type { GraphicPresetsModule } from '@bootstrap/wiring/graphics';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { CaptionlessSpanRefresher } from '@core/shots/services/CaptionlessSpanRefresher';
import { SaveShotGraphicPresetAction } from '@core/shots/actions/SaveShotGraphicPresetAction';
import { ShotGraphicPresetCapture } from '@core/shots/services/ShotGraphicPresetCapture';
import { ShotGraphicFootageBuilder } from '@core/shots/services/ShotGraphicFootageBuilder';
import { ShotGraphicStageBuilder } from '@core/shots/services/ShotGraphicStageBuilder';
import { ShotGraphicCheck } from '@core/shots/services/ShotGraphicCheck';
import { GraphicCheck } from '@core/graphics/services/GraphicCheck';
import { ShotGraphicPresetSounds } from '@core/shots/services/ShotGraphicPresetSounds';
import { ShotGraphicPresetMotion } from '@core/shots/services/ShotGraphicPresetMotion';
import { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';
import { ShotElementSounds } from '@core/shots/services/ShotElementSounds';
import { ResetShotElementAction } from '@core/shots/actions/ResetShotElementAction';

export interface ShotsDependencies {
  readonly store: EditorStore;
  /** Where shots read the Original track's words, whatever track is active. */
  readonly originalCaptions: OriginalCaptionTrackReader;
  readonly mediaAssets: MediaAssetStore;
  readonly mediaBytes: MediaAssetBytesRepository;
  readonly mediaPreparer: MediaAssetPreparer;
  readonly gifPlayback: GifPlaybackProbe;
  readonly mediaProxyCache: MediaAssetProxyCache;
  readonly previewSurface: VideoPreviewSurface;
  readonly animationCatalog: ElementAnimationCatalog;
  readonly animationCssWriter: ElementAnimationCssWriter;
  readonly elementCssLayerBuilder: ElementCssLayerBuilder;
  readonly controlCssWriter: ElementControlCssWriter;
  readonly styledElementCatalog: StyledElementCatalog;
  readonly footageResolvers: FootageLayerResolverFactory;
  /** Plays the graphics shot layers show, in the preview and the export. */
  readonly graphicPlayers: GraphicPlayerFactory;
  readonly graphicPresets: GraphicPresetsModule;
  readonly refresh: RefreshDocumentAction;
  /** Follows a person through a stretch of the video, for a shot's camera to follow them. */
  readonly planFollow: PlanPersonFollowAction;
  readonly telemetry: Telemetry;
}

export type ShotsModule = ReturnType<typeof bootShots>;

/**
 * Boots the shots feature: cutting the video into the stretches of
 * footage the Video panel works a shot at a time, the gestures that
 * reshape that partition, and what the preview shows and the export
 * burns of each shot.
 *
 * Shots read their words off the Original caption track whatever track
 * is active, through `originalCaptions`: they are about the video.
 *
 * A layer sits, looks and moves as its CSS says, which the engine
 * resolves, as it does a caption's; where it sits is its layout's
 * fields, which write that CSS. The preview and the boxes a press on
 * the preview picks ask one resolver, held in the footage store, so a
 * moment is resolved once for both; the export opens its own.
 */
export function bootShots(deps: ShotsDependencies) {
  const pictureChangeLocator = new PictureChangeLocator();
  const openingPlacer = new ShotOpeningPlacer();
  const partitioner = new ShotPartitioner(
    new ShotBoundaryFinder(new SentenceBoundaryClassifier(), pictureChangeLocator),
    openingPlacer,
    new CutAwareDocumentBuilder(),
  );
  const materializer = new ShotPartitionMaterializer(partitioner, deps.originalCaptions);
  const wordOpenings = new ShotWordOpeningResolver(deps.originalCaptions, pictureChangeLocator, openingPlacer);
  const telemetryBudget = new TelemetryBudget(deps.store);
  const errorNames = new ErrorNameTelemetryDescriber();
  const editTelemetry = new ShotEditTelemetryReporter(deps.telemetry, telemetryBudget, errorNames);
  const graphicTelemetry = new ShotGraphicTelemetryReporter(deps.telemetry, telemetryBudget, deps.graphicPresets.telemetryDescriber);
  const layoutChanges = new ShotLayerLayoutChangeReader();
  const moveStart = new MoveShotStartAction(deps.store, materializer, editTelemetry);
  const setFollow = new SetShotFollowAction(deps.store, materializer);
  const splitShot = new SplitShotAction(deps.store, materializer, editTelemetry);
  const layerAssets = new ShotLayerAssetReader();
  const layerTiming = new ShotLayerTiming(layerAssets);
  const footageLayerBuilder = new ShotFootageLayerBuilder();
  const graphicMessages = new GraphicMessageLog();
  const graphicPresets = deps.graphicPresets.catalog;
  const graphicBoxes = new GraphicBoxPlacement();
  const graphicMoments = new RecordShotGraphicMomentsAction(deps.store, new GraphicSanitizer());
  const graphicStages = new ShotGraphicStageBuilder(new ShotLayerBoxShape());
  const graphicFootageBuilder = new ShotGraphicFootageBuilder(
    deps.graphicPlayers,
    graphicStages,
    graphicMessages,
    graphicMoments,
    new TelemetryShotGraphicFailureRecorder(deps.telemetry, deps.graphicPresets.telemetryDescriber, errorNames),
  );
  const stageBuilder = new ShotLayerStageBuilder(
    deps.elementCssLayerBuilder,
    new ShotTransitionStyleWriter(BUILTIN_SHOT_LAYER_STAGE_CSS),
    BUILTIN_SHOT_LAYER_STAGE_CSS,
    new OutputFrameCss(),
    new ShotFollowCameraWriter(),
  );
  const followCrop = new ShotFollowCrop(deps.animationCatalog);
  const followStager = new ShotFollowStager(followCrop, new CameraPathPlanner(new HeadFraming()));
  const videoPictureBuilder = new VideoPictureFootageBuilder();
  const transitionLayerBuilder = new ShotTransitionLayerBuilder(new ShotTransitionCuts());
  const transitionSounds = new ShotTransitionSoundSuggestions();
  const layerTransitionSounds = new LayerTransitionSoundSuggestions();
  const previewFootage = new ShotLayerPreviewFootageStore();
  const placementSanitizer = new ShotLayerPlacementSanitizer();
  const layerPatcher = new ShotLayerPatcher(placementSanitizer);
  const layoutWriter = new ShotLayerLayoutWriter(
    deps.styledElementCatalog,
    deps.controlCssWriter,
    new ShotLayerLayoutFields(placementSanitizer),
  );
  const filePlayback = new ShotFilePlaybackCheck(deps.mediaAssets, deps.mediaPreparer);
  const lastEditedPlacements = new LastEditedPlacementRecorder(deps.mediaAssets, layerAssets);
  const splitTransitions = new ShotLayerSplitTransitions();
  const insetTransitions = new ShotLayerInsetTransitions();
  const clipDefaults = new AudioClipDefaults();
  const setCamera = new SetShotCameraAction(
    deps.store,
    materializer,
    deps.styledElementCatalog,
    deps.controlCssWriter,
    deps.animationCatalog,
    deps.animationCssWriter,
    new ShotCameraSounds(),
    clipDefaults,
    deps.mediaAssets,
    layerAssets,
    new ShotLayerBoxShape(),
    editTelemetry,
  );
  const elementSounds = new ShotElementSounds();
  const graphicPresetSounds = new ShotGraphicPresetSounds(clipDefaults, elementSounds);
  const graphicPresetMotion = new ShotGraphicPresetMotion(deps.animationCatalog, deps.animationCssWriter);
  const layoutFollower = new TransitionSoundShotLayoutFollower(splitTransitions, insetTransitions, layerTransitionSounds, clipDefaults);
  const graphicPresetApplier = new ShotGraphicPresetApplier(layoutWriter, graphicBoxes, graphicPresetSounds, graphicPresetMotion);
  const showFile = new ShowFileOnShotAction(
    deps.store,
    materializer,
    deps.mediaAssets,
    layerAssets,
    filePlayback,
    layoutWriter,
    layoutFollower,
    editTelemetry,
  );
  const setLayerSplitTransition = new SetShotLayerSplitTransitionAction(
    deps.store,
    deps.styledElementCatalog,
    deps.controlCssWriter,
    splitTransitions,
  );
  const setLayerInsetTransition = new SetShotLayerInsetTransitionAction(
    deps.store,
    deps.styledElementCatalog,
    deps.controlCssWriter,
    insetTransitions,
  );
  new CaptionlessSpanRefresher(deps.store, deps.refresh).start();
  return {
    services: {
      partitioner,
      followStager,
      materializer,
      wordOpenings,
      originalCaptions: deps.originalCaptions,
      resolver: new ShotResolver(),
      layerCoverage: new ShotLayerCoverage(layerTiming),
      layerAssets,
      layerTiming,
      stageBuilder,
      layoutWriter,
      layerPatcher,
      splitTransitions,
      insetTransitions,
      transitionSounds,
      layerTransitionSounds,
      previewFootage,
      graphicMessages,
      graphicPresets,
      graphicPresetLibrary: deps.graphicPresets,
      graphicPresetThumbnails: new GraphicPresetThumbnailStore(new GraphicFilmstripRecorder(deps.graphicPlayers)),
      graphicCheck: new ShotGraphicCheck(deps.store, deps.mediaAssets, layerTiming, graphicStages, new GraphicCheck(deps.graphicPlayers), graphicMoments),
      cssParser: new CssFragmentParser(new CssMinifier()),
    },
    exportContributor: new ShotLayerExportContributor(
      deps.mediaBytes,
      layerTiming,
      footageLayerBuilder,
      videoPictureBuilder,
      transitionLayerBuilder,
      stageBuilder,
      deps.gifPlayback,
      graphicFootageBuilder,
      followStager,
    ),
    previewAutomation: new ShotLayerPreviewAutomation(
      deps.store,
      deps.previewSurface,
      layerTiming,
      footageLayerBuilder,
      videoPictureBuilder,
      transitionLayerBuilder,
      stageBuilder,
      deps.footageResolvers,
      previewFootage,
      deps.mediaAssets,
      deps.mediaPreparer,
      deps.mediaProxyCache,
      graphicFootageBuilder,
      followStager,
    ),
    actions: {
      split: splitShot,
      splitBeforeWord: new SplitShotBeforeWordAction(deps.store, wordOpenings, splitShot),
      join: new JoinShotAction(deps.store, materializer, editTelemetry),
      setTransition: new SetShotTransitionAction(deps.store, materializer, transitionSounds, clipDefaults, editTelemetry),
      setFollow,
      followPerson: new FollowPersonOnShotAction(deps.store, materializer, deps.planFollow, followCrop, setFollow, setCamera),
      moveStart,
      moveStartToWord: new MoveShotStartToWordAction(deps.store, wordOpenings, moveStart),
      repropose: new ReproposeShotsAction(deps.store, editTelemetry),
      addLayer: new AddShotLayerAction(deps.store, materializer),
      addGraphic: new AddShotGraphicAction(deps.store, materializer, graphicPresetApplier, graphicTelemetry),
      setGraphic: new SetShotGraphicAction(deps.store, graphicPresetApplier, graphicTelemetry),
      saveGraphicPreset: new SaveShotGraphicPresetAction(
        deps.store,
        new ShotGraphicPresetCapture(graphicBoxes),
        deps.graphicPresets.repository,
        deps.graphicPresets.store,
        deps.graphicPresets.names,
        graphicTelemetry,
      ),
      reset: new ResetShotElementAction(
        deps.store,
        materializer,
        deps.mediaAssets,
        layerAssets,
        layoutWriter,
        layoutFollower,
        graphicPresets,
        graphicPresetApplier,
        elementSounds,
      ),
      showFile,
      showFileOnCurrentShot: new ShowFileOnCurrentShotAction(deps.store, materializer, showFile),
      removeLayers: new RemoveShotLayersAction(deps.store, deps.mediaAssets, editTelemetry),
      replaceLayerFile: new ReplaceShotLayerFileAction(deps.store, deps.mediaAssets, layerAssets, filePlayback, editTelemetry),
      setLayerTiming: new SetShotLayerTimingAction(deps.store),
      setLayerThrough: new SetShotLayerThroughAction(deps.store),
      setVideoThrough: new SetShotVideoThroughAction(deps.store),
      setLayerPlacement: new SetShotLayerPlacementAction(deps.store, layoutWriter, lastEditedPlacements, layoutFollower, layoutChanges, editTelemetry),
      patchLayers: new PatchShotLayersAction(
        deps.store,
        deps.mediaAssets,
        layerAssets,
        layerPatcher,
        layoutWriter,
        lastEditedPlacements,
        layoutFollower,
        layoutChanges,
        editTelemetry,
      ),

      setLayerAnimation: new SetShotLayerAnimationAction(deps.store, materializer, deps.animationCatalog, deps.animationCssWriter, editTelemetry),
      setLayerInsetTransition,
      setLayerSplitTransition,
      setLayerTransition: new SetShotLayerTransitionAction(
        deps.store,
        setLayerSplitTransition,
        setLayerInsetTransition,
        splitTransitions,
        insetTransitions,
        layerTransitionSounds,
        clipDefaults,
        editTelemetry,
      ),
      setLayerCss: new SetShotLayerCssAction(deps.store, materializer),
      setCamera,
    },
    editTelemetry,
  };
}
