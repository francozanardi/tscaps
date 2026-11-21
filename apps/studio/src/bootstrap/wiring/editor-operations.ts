import { CaptionLineReadout } from '@core/editor-operations/services/CaptionLineReadout';
import { CaptionMarks } from '@core/editor-operations/services/CaptionMarks';
import { CaptionRowReadout } from '@core/editor-operations/services/CaptionRowReadout';
import { TranscriptTextReadout } from '@core/editor-operations/services/TranscriptTextReadout';
import { GraphemeWordSplitter } from '@tscaps/engine';
import { CssBlockSealer, CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import { ActiveSheetEditRunner } from '@core/editor-operations/services/ActiveSheetEditRunner';
import { AnimationPresetReadout } from '@core/editor-operations/services/AnimationPresetReadout';
import { CaptionElementReadout } from '@core/editor-operations/services/CaptionElementReadout';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { CaptionSceneLocator } from '@core/editor-operations/services/CaptionSceneLocator';
import { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import { EditorOperationCatalog } from '@core/editor-operations/services/EditorOperationCatalog';
import { EditorOperationRunner } from '@core/editor-operations/services/EditorOperationRunner';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ElementStyleReadout } from '@core/editor-operations/services/ElementStyleReadout';
import { GraphicReadout } from '@core/editor-operations/services/GraphicReadout';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { SheetCssWriteChecker } from '@core/editor-operations/services/SheetCssWriteChecker';
import { SheetReadout } from '@core/editor-operations/services/SheetReadout';
import { TemplateSwitchReadout } from '@core/editor-operations/services/TemplateSwitchReadout';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { ShotLayerReadout } from '@core/editor-operations/services/ShotLayerReadout';
import { ShotReadout } from '@core/editor-operations/services/ShotReadout';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SoundClipReadout } from '@core/editor-operations/services/SoundClipReadout';
import { WordTagLookChecker } from '@core/editor-operations/services/WordTagLookChecker';
import { AddGraphicOperation } from '@core/editor-operations/services/descriptors/AddGraphicOperation';
import { LayerRunWriter } from '@core/editor-operations/services/LayerRunWriter';
import { EditGraphicOperation } from '@core/editor-operations/services/descriptors/EditGraphicOperation';
import { JoinShotsOperation } from '@core/editor-operations/services/descriptors/JoinShotsOperation';
import { PlaceMediaOperation } from '@core/editor-operations/services/descriptors/PlaceMediaOperation';
import { RemoveLayersOperation } from '@core/editor-operations/services/descriptors/RemoveLayersOperation';
import { SetLayerOperation } from '@core/editor-operations/services/descriptors/SetLayerOperation';
import { SplitShotsOperation } from '@core/editor-operations/services/descriptors/SplitShotsOperation';
import { CustomGraphicPresetReader } from '@core/editor-operations/services/CustomGraphicPresetReader';
import { GraphicFillCheck } from '@core/editor-operations/services/GraphicFillCheck';
import { GraphicPlaybackCheck } from '@core/editor-operations/services/GraphicPlaybackCheck';
import { GraphicTextCheck } from '@core/editor-operations/services/GraphicTextCheck';
import { GraphicDocumentCheck } from '@core/editor-operations/services/GraphicDocumentCheck';
import { GraphicFontFamilyCheck } from '@core/editor-operations/services/GraphicFontFamilyCheck';
import { FONT_FAMILIES } from '@core/fonts/domain/FontFamilyCatalog';
import { GraphicFieldsCheck } from '@core/editor-operations/services/GraphicFieldsCheck';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { AddSoundsOperation } from '@core/editor-operations/services/descriptors/AddSoundsOperation';
import { CrowdedSoundFinder } from '@core/editor-operations/services/CrowdedSoundFinder';
import { ClearElementStyleOperation } from '@core/editor-operations/services/descriptors/ClearElementStyleOperation';
import { AudioLevelsReader } from '@core/editor-operations/services/AudioLevelsReader';
import { SilenceSoundTrimmer } from '@core/editor-operations/services/SilenceSoundTrimmer';
import { GetAudioOperation } from '@core/editor-operations/services/descriptors/GetAudioOperation';
import { CutVideoOperation } from '@core/editor-operations/services/descriptors/CutVideoOperation';
import { EditWordsOperation } from '@core/editor-operations/services/descriptors/EditWordsOperation';
import { GetElementOperation } from '@core/editor-operations/services/descriptors/GetElementOperation';
import { GetProjectOperation } from '@core/editor-operations/services/descriptors/GetProjectOperation';
import { GetTakesOperation } from '@core/editor-operations/services/descriptors/GetTakesOperation';
import { GetTranscriptOperation } from '@core/editor-operations/services/descriptors/GetTranscriptOperation';
import { ListCatalogOperation } from '@core/editor-operations/services/descriptors/ListCatalogOperation';
import { RemoveSoundsOperation } from '@core/editor-operations/services/descriptors/RemoveSoundsOperation';
import { SetAudioOperation } from '@core/editor-operations/services/descriptors/SetAudioOperation';
import { LayerTransitionWriter } from '@core/editor-operations/services/LayerTransitionWriter';
import { SetTimingOperation } from '@core/editor-operations/services/descriptors/SetTimingOperation';
import { InsertCaptionOperation } from '@core/editor-operations/services/descriptors/InsertCaptionOperation';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SetCaptionTypographyOperation } from '@core/editor-operations/services/descriptors/SetCaptionTypographyOperation';
import { SetCaptionPositionOperation } from '@core/editor-operations/services/descriptors/SetCaptionPositionOperation';
import { AnimationPresetCheck } from '@core/editor-operations/services/AnimationPresetCheck';
import { SheetAnimationWriter } from '@core/editor-operations/services/SheetAnimationWriter';
import { SetCaptionElementEffectsOperation } from '@core/editor-operations/services/descriptors/SetCaptionElementEffectsOperation';
import { SetCaptionElementStyleOperation } from '@core/editor-operations/services/descriptors/SetCaptionElementStyleOperation';
import { FieldShadowingDeclarations } from '@core/elements/services/css/FieldShadowingDeclarations';
import { CaptionAncestorLocator } from '@core/editor-operations/services/CaptionAncestorLocator';
import { SetCameraOperation } from '@core/editor-operations/services/descriptors/SetCameraOperation';
import { SetFramingOperation } from '@core/editor-operations/services/descriptors/SetFramingOperation';
import { SetColorGradeOperation } from '@core/editor-operations/services/descriptors/SetColorGradeOperation';
import { SetElementAnimationOperation } from '@core/editor-operations/services/descriptors/SetElementAnimationOperation';
import { SetElementCssOperation } from '@core/editor-operations/services/descriptors/SetElementCssOperation';
import { SetEmojiOperation } from '@core/editor-operations/services/descriptors/SetEmojiOperation';
import { SetOutputFrameOperation } from '@core/editor-operations/services/descriptors/SetOutputFrameOperation';
import { SetSegmentsHiddenOperation } from '@core/editor-operations/services/descriptors/SetSegmentsHiddenOperation';
import { SetSheetCssOperation } from '@core/editor-operations/services/descriptors/SetSheetCssOperation';
import { SetStyleControlsOperation } from '@core/editor-operations/services/descriptors/SetStyleControlsOperation';
import { DocumentEditor } from '@tscaps/engine';
import { CaptionStructureEditor } from '@core/editor-operations/services/CaptionStructureEditor';
import { CreateSpeakerSheetOperation } from '@core/editor-operations/services/descriptors/CreateSpeakerSheetOperation';
import { DeleteWordsOperation } from '@core/editor-operations/services/descriptors/DeleteWordsOperation';
import { JoinCaptionsOperation } from '@core/editor-operations/services/descriptors/JoinCaptionsOperation';
import { ElementCssReads } from '@core/editor-operations/services/ElementCssReads';
import { MakeCaptionOperation } from '@core/editor-operations/services/descriptors/MakeCaptionOperation';
import { SetCaptionLinesOperation } from '@core/editor-operations/services/descriptors/SetCaptionLinesOperation';
import { SplitCaptionOperation } from '@core/editor-operations/services/descriptors/SplitCaptionOperation';
import { CreateSheetOperation } from '@core/editor-operations/services/descriptors/CreateSheetOperation';
import { DeleteSheetOperation } from '@core/editor-operations/services/descriptors/DeleteSheetOperation';
import { EditSheetOperation } from '@core/editor-operations/services/descriptors/EditSheetOperation';
import { MoveToSheetOperation } from '@core/editor-operations/services/descriptors/MoveToSheetOperation';
import { SetHookCaptionsOperation } from '@core/editor-operations/services/descriptors/SetHookCaptionsOperation';
import { ShownDecorationReader } from '@core/editor-operations/services/ShownDecorationReader';
import { SetCaptionEffectsOperation } from '@core/editor-operations/services/descriptors/SetCaptionEffectsOperation';
import { SceneRefsReader } from '@core/editor-operations/services/SceneRefsReader';
import { SetTemplateOperation } from '@core/editor-operations/services/descriptors/SetTemplateOperation';
import { SetTransitionOperation } from '@core/editor-operations/services/descriptors/SetTransitionOperation';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { BUILTIN_TEMPLATE_ASSETS } from '@core/templates/infrastructure/BuiltinTemplateAssets';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { AudioMixModule } from '@bootstrap/wiring/audio-mix';
import type { CaptionsModule } from '@bootstrap/wiring/captions';
import type { ColorGradeModule } from '@bootstrap/wiring/color-grade';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import type { ElementsModule } from '@bootstrap/wiring/elements';
import type { MediaModule } from '@bootstrap/wiring/media';
import type { OutputFrameModule } from '@bootstrap/wiring/output-frame';
import { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import { EditTakes } from '@core/shots/services/EditTakes';
import { ShotLayerPanPace } from '@core/shots/services/ShotLayerPanPace';
import { ShotPictureArea } from '@core/shots/services/ShotPictureArea';
import type { PersonSegmentationModule } from '@bootstrap/wiring/person-segmentation';
import type { RenderingModule } from '@bootstrap/wiring/rendering';
import type { SheetsModule } from '@bootstrap/wiring/sheets';
import type { ShotsModule } from '@bootstrap/wiring/shots';
import type { UserTemplatesModule } from '@bootstrap/wiring/user-templates';

export interface EditorOperationsDependencies {
  readonly store: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly originalCaptions: OriginalCaptionTrackReader;
  readonly rendering: RenderingModule;
  readonly elements: ElementsModule;
  readonly captions: CaptionsModule;
  readonly sheets: SheetsModule;
  readonly userTemplates: UserTemplatesModule;
  readonly shots: ShotsModule;
  readonly media: MediaModule;
  readonly audioMix: AudioMixModule;
  readonly colorGrade: ColorGradeModule;
  readonly outputFrame: OutputFrameModule;
  readonly cuts: CutsModule;
  readonly personSegmentation: PersonSegmentationModule;
}

export type EditorOperationsModule = ReturnType<typeof bootEditorOperations>;

/**
 * Boots the editor's operation catalog: the typed surface a program uses
 * to read and edit the open project through the editor's own actions,
 * each edit undoable. The same on every surface.
 */
export function bootEditorOperations(deps: EditorOperationsDependencies) {
  const { store } = deps;
  const parser = new EditorRefParser();
  const audioLevels = new AudioLevelsReader(store, deps.cuts.services.waveformExtractor);
  const format = new ReadoutFormatter();
  const captionRefs = new CaptionRefResolver(store, parser);
  const sheetRefs = new SheetRefResolver(store, parser);
  const shotRefs = new ShotRefResolver(store, deps.shots.services.materializer, parser);
  const layerRuns = new LayerRunWriter(store, shotRefs, parser, deps.shots.actions.setLayerThrough);
  const cssGate = new CssWriteGate();
  const cssReads = new ElementCssReads(store);
  const scenes = new CaptionSceneLocator();
  const reflow = new CaptionReflowDetector();
  const sceneRefs = new SceneRefsReader(captionRefs);
  const captionStructure = new CaptionStructureEditor(new DocumentEditor());
  const sheetActions = deps.sheets.actions.sheets;
  const activeSheetEdits = new ActiveSheetEditRunner(store, deps.sheets.actions.sheets.setActive);
  const sheetCssChecker = new SheetCssWriteChecker(cssGate, new CssMinifier(), new CssBlockSealer(), deps.rendering.templateContractValidator, deps.rendering.svgFilterDefinitionsParser);
  const styleReadout = new ElementStyleReadout(format);
  const graphicReadout = new GraphicReadout(deps.shots.services.graphicPresets, deps.shots.services.graphicMessages, format);
  const layerReadout = new ShotLayerReadout(deps.media.assets, deps.shots.services.layerAssets, graphicReadout, styleReadout, deps.shots.services.splitTransitions, deps.shots.services.insetTransitions, parser, format);
  const shotReadout = new ShotReadout(layerReadout, styleReadout, format);
  const soundReadout = new SoundClipReadout(deps.audioMix.services.timing, deps.media.assets, deps.audioMix.services.builtinSounds, deps.originalCaptions, parser, format);
  const shownDecorations = new ShownDecorationReader(deps.sheets.decorationFilter);
  const captionMarks = new CaptionMarks();
  const captionReadout = new CaptionElementReadout(parser, styleReadout, format, shownDecorations);
  const sheetReadout = new SheetReadout(parser, styleReadout, format);
  const templateSwitches = new TemplateSwitchReadout(sheetReadout);
  const graphicSanitizer = new GraphicSanitizer();
  const graphicFields = new GraphicFieldsCheck(graphicSanitizer);
  const graphicDocuments = new GraphicDocumentCheck(cssGate, new GraphicFontFamilyCheck(FONT_FAMILIES));
  const graphicFill = new GraphicFillCheck(deps.shots.services.graphicCheck);
  const graphicPlayback = new GraphicPlaybackCheck(store, deps.shots.services.graphicCheck, graphicFill, new GraphicTextCheck());
  const customGraphics = new CustomGraphicPresetReader(graphicSanitizer, graphicFields, graphicDocuments, deps.rendering.animationCatalog, deps.audioMix.services.builtinSounds);
  const animationPresets = new AnimationPresetReadout(deps.rendering.animationCatalog, deps.elements.services.styledElementCatalog, deps.elements.services.timingVariableResolver, format);

  const animationPresetCheck = new AnimationPresetCheck(deps.elements.services.animationCatalog, deps.elements.services.timingVariableResolver);
  const sheetAnimations = new SheetAnimationWriter(
    store, activeSheetEdits, animationPresetCheck, deps.elements.services.animationSupport,
    deps.elements.services.templateAnimationAnswer, deps.elements.services.templateAnimationFields,
    deps.sheets.actions.style.setAnimation, deps.sheets.actions.style.tuneAnimation, deps.sheets.actions.style.resetMotion,
  );
  const layerTransitions = new LayerTransitionWriter(deps.shots.actions.setLayerTransition, deps.shots.actions.setLayerSplitTransition, deps.shots.actions.setLayerInsetTransition);
  const pictureArea = new ShotPictureArea(deps.rendering.animationCatalog);
  const aimPoint = new ShotAimPoint();
  const operations: EditorOperation[] = [
    new GetProjectOperation(store, shotRefs, shotReadout, soundReadout, deps.originalCaptions, parser, format),
    new GetTranscriptOperation(store, format, shownDecorations, new TranscriptTextReadout(format), new CaptionLineReadout(parser, format, captionMarks), new CaptionRowReadout(parser, format, captionMarks)),
    new GetAudioOperation(store, audioLevels, parser, format),
    new GetTakesOperation(store, shotRefs, deps.personSegmentation.pictureChangeReader, new EditTakes(), parser, format),
    new GetElementOperation(store, parser, captionRefs, shotRefs, sheetRefs, captionReadout, layerReadout, shotReadout, sheetReadout, soundReadout, cssReads),
    new ListCatalogOperation(store, deps.userTemplates.store, BUILTIN_TEMPLATE_ASSETS, animationPresets, deps.shots.services.graphicPresets, graphicReadout, deps.audioMix.services.builtinSounds, deps.media.assets, deps.colorGrade.looks, format),
    new SetTemplateOperation(
      sheetRefs,
      store,
      deps.userTemplates.store,
      parser,
      activeSheetEdits,
      deps.sheets.actions.style.setTemplate,
      reflow,
      templateSwitches,
    ),
    new CreateSheetOperation(store, parser, sceneRefs, reflow, sheetActions.create, sheetActions.setActive, sheetActions.assignSelectedSegments),
    new MoveToSheetOperation(store, parser, sheetRefs, sceneRefs, reflow, sheetActions.assignSelectedSegments),
    new SetHookCaptionsOperation(store, parser, sceneRefs, reflow, sheetActions.setHookScenes, sheetActions.setActive),
    new EditSheetOperation(store, parser, sheetRefs, sheetActions.rename, sheetActions.link, sheetActions.unlink),
    new DeleteSheetOperation(store, parser, sheetRefs, reflow, sheetActions.delete),
    new CreateSpeakerSheetOperation(store, parser, reflow, deps.sheets.sheetCreationOptionFinder, sheetActions.createSpeaker, sheetActions.rename, sheetActions.setActive),
    new SplitCaptionOperation(store, parser, captionRefs, captionStructure, deps.captions.actions.segments.applyStructureEdit),
    new JoinCaptionsOperation(store, parser, captionRefs, captionStructure, deps.captions.actions.segments.applyStructureEdit),
    new MakeCaptionOperation(store, parser, captionRefs, captionStructure, deps.captions.actions.segments.applyStructureEdit),
    new SetCaptionLinesOperation(store, parser, captionRefs, captionStructure, deps.captions.actions.segments.applyStructureEdit),
    new DeleteWordsOperation(captionRefs, deps.captions.actions.words.delete),
    new SetTimingOperation(captionRefs, store, deps.captions.actions.words.editTime, deps.captions.actions.segments.editTime, format),
    new InsertCaptionOperation(
      store, parser, captionRefs, new SegmentHardTime(), deps.captions.services.segmentTimeBounds,
      deps.captions.actions.segments.insert, deps.captions.actions.segments.editTime,
      deps.captions.actions.words.editText, deps.captions.actions.segments.redistributeWords, format,
    ),
    new SetCaptionEffectsOperation(store, parser, sheetRefs, activeSheetEdits, deps.sheets.actions.style.updateEffects),
    new SetStyleControlsOperation(
      sheetRefs, store, parser, activeSheetEdits, deps.sheets.actions.style.updateControl,
      new FontStackLibrary(), deps.refresh, reflow,
    ),
    new SetCaptionTypographyOperation(
      sheetRefs, store, parser, new FontStackLibrary(), activeSheetEdits,
      deps.sheets.actions.style.updateTypography, deps.sheets.actions.style.updateVariant, deps.refresh, reflow,
    ),
    new SetCaptionPositionOperation(sheetRefs, parser, deps.sheets.actions.style.updateAlignment, deps.sheets.actions.style.updateRotation),
    new SetSheetCssOperation(
      sheetRefs, store, parser, activeSheetEdits, deps.sheets.actions.style.updateSheetCssOverride,
      deps.sheets.actions.style.updateSheetFiltersSvgOverride, deps.refresh, sheetCssChecker, reflow,
    ),
    new SetElementCssOperation(captionRefs, shotRefs, deps.elements.actions.setCss, deps.shots.actions.setLayerCss, deps.elements.services.cssValidator, cssGate, cssReads),
    new SetElementAnimationOperation(
      captionRefs, shotRefs, scenes, store, sheetRefs, deps.elements.services.styledElementCatalog,
      animationPresetCheck, deps.elements.services.animationCssWriter, deps.elements.services.animationSupport,
      deps.elements.actions.setAnimation, deps.shots.actions.setLayerAnimation, sheetAnimations,
    ),
    new ClearElementStyleOperation(captionRefs, store, deps.elements.actions.reset, reflow),
    new EditWordsOperation(captionRefs, store, parser, deps.captions.actions.words.editText, deps.captions.actions.words.editTags, new WordTagLookChecker(store)),
    new SetEmojiOperation(
      captionRefs,
      store,
      parser,
      new GraphemeWordSplitter(),
      deps.captions.actions.decorations.add,
      deps.captions.actions.decorations.clear,
      shownDecorations,
    ),
    new SetSegmentsHiddenOperation(captionRefs, store, deps.captions.actions.segments.setHidden),
    new SetCaptionElementStyleOperation(
      captionRefs, scenes, store, deps.elements.services.styledElementCatalog, new FontStackLibrary(),
      deps.elements.services.cssControlledFieldFinder, deps.elements.actions.setField, deps.elements.actions.setPlacement,
      new FieldShadowingDeclarations(new CssFragmentParser(new CssMinifier())), deps.elements.actions.setCss,
    ),
    new SetCaptionElementEffectsOperation(
      captionRefs, scenes, new CaptionAncestorLocator(), parser, store,
      deps.captions.actions.setBehindActorOverride, deps.personSegmentation.actions.ensureSegmentMasks,
      deps.elements.actions.setBlend, deps.personSegmentation.gatingService, deps.personSegmentation.footageCoverage, deps.media.assets,
    ),
    new SplitShotsOperation(
      store, shotRefs, parser,
      deps.shots.services.wordOpenings,
      deps.shots.actions.split,
      deps.shots.actions.moveStart,
      deps.personSegmentation.pictureChangeReader,
    ),
    new JoinShotsOperation(store, shotRefs, parser, deps.shots.actions.join),
    new PlaceMediaOperation(shotRefs, deps.media.assets, parser, deps.shots.actions.showFile, layerRuns),
    new SetLayerOperation(store, shotRefs, deps.media.assets, deps.shots.actions.patchLayers, deps.shots.services.layerPatcher, layerRuns, graphicFill, layerTransitions),
    new RemoveLayersOperation(store, shotRefs, parser, deps.shots.actions.removeLayers),
    new AddGraphicOperation(shotRefs, parser, deps.shots.services.graphicPresets, customGraphics, graphicFields, deps.shots.actions.addGraphic, graphicPlayback, layerRuns),
    new EditGraphicOperation(store, shotRefs, parser, graphicFields, graphicDocuments, deps.shots.actions.setGraphic, deps.shots.actions.setLayerPlacement, graphicPlayback),
    new SetCameraOperation(
      store, shotRefs, parser, deps.rendering.animationCatalog, deps.rendering.animationCssWriter, new ShotCameraSounds(),
      deps.shots.actions.setCamera, deps.shots.actions.setLayerAnimation, deps.audioMix.actions.removeClips,
      pictureArea, aimPoint, deps.shots.actions.setVideoThrough,
      new ShotLayerPanPace(deps.media.assets, deps.shots.services.layerAssets, new ShotLayerBoxShape()),
    ),
    new SetFramingOperation(
      store, shotRefs, deps.rendering.animationCatalog, deps.rendering.animationCssWriter, deps.shots.actions.setCamera, pictureArea, aimPoint,
    ),
    new SetTransitionOperation(store, shotRefs, parser, deps.shots.services.transitionSounds, deps.shots.actions.setTransition),
    new AddSoundsOperation(
      store, parser, shotRefs, deps.shots.services.materializer, deps.originalCaptions, deps.audioMix.services.timing,
      deps.cuts.services.renderTimeMapBuilder, deps.media.assets, deps.audioMix.services.builtinSounds, deps.audioMix.actions.addClips,
      new CrowdedSoundFinder(deps.audioMix.services.timing, deps.audioMix.services.builtinSounds),
    ),
    new RemoveSoundsOperation(store, parser, deps.audioMix.actions.removeClips),
    new SetAudioOperation(
      store, parser, shotRefs, deps.media.assets, deps.shots.services.layerAssets, format,
      deps.audioMix.actions.setSourceVolume, deps.audioMix.actions.setShotVideoVolume, deps.audioMix.actions.setFootageSound,
      deps.audioMix.actions.useAsMusic, deps.audioMix.actions.patchClips, deps.audioMix.actions.removeClips,
    ),
    new SetColorGradeOperation(store, deps.colorGrade.looks, deps.colorGrade.actions.set),
    new SetOutputFrameOperation(store, deps.outputFrame.actions.set),
    new CutVideoOperation(
      store, captionRefs, deps.originalCaptions, deps.cuts.services.silenceFinder,
      deps.cuts.actions.add, deps.cuts.actions.restoreRange, deps.cuts.actions.removeSilences,
      audioLevels, new SilenceSoundTrimmer(),
    ),
  ];
  const catalog = new EditorOperationCatalog(operations);
  return {
    services: {
      parser,
      templateSwitches,
      captionRefs,
      sheetRefs,
      shotRefs,
      catalog,
      runner: new EditorOperationRunner(catalog, store),
    },
  };
}
