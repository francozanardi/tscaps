import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { ShotsOnlyLayoutFollower } from '@core/shots/testing/ShotsOnlyLayoutFollower';
import { EditorStore } from '@core/editor/store/EditorStore';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import { SetShotVideoVolumeAction } from '@core/audio-mix/actions/SetShotVideoVolumeAction';
import { JoinShotAction } from '@core/shots/actions/JoinShotAction';
import { SetShotFollowAction } from '@core/shots/actions/SetShotFollowAction';
import type { ShotFollow } from '@core/shots/domain/ShotFollow';
import { ShotPartition, type ShotsSnapshot } from '@core/shots/domain/ShotPartition';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import { ReproposeShotsAction } from '@core/shots/actions/ReproposeShotsAction';
import { AddShotGraphicAction } from '@core/shots/actions/AddShotGraphicAction';
import { SetShotGraphicAction } from '@core/shots/actions/SetShotGraphicAction';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { LibraryGraphicPresetCatalog } from '@core/graphics/infrastructure/LibraryGraphicPresetCatalog';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { SavedGraphicPresetRepository } from '@core/graphics/domain/SavedGraphicPresetRepository';
import { StoredGraphicPresetStyleReader } from '@core/graphics/infrastructure/StoredGraphicPresetStyleReader';
import { GraphicPresetManifestReader } from '@core/graphics/services/GraphicPresetManifestReader';
import { GraphicPresetManifestWriter } from '@core/graphics/services/GraphicPresetManifestWriter';
import { GraphicPresetMatcher } from '@core/graphics/services/GraphicPresetMatcher';
import { GraphicPresetNameValidator } from '@core/graphics/services/GraphicPresetNameValidator';
import { SavedGraphicPresetStore } from '@core/graphics/store/SavedGraphicPresetStore';
import { SaveShotGraphicPresetAction } from '@core/shots/actions/SaveShotGraphicPresetAction';
import { SetShotLayerInsetTransitionAction } from '@core/shots/actions/SetShotLayerInsetTransitionAction';
import { ShotLayerInsetTransitions } from '@core/shots/domain/ShotLayerInsetTransitions';
import { ShotGraphicPresetCapture } from '@core/shots/services/ShotGraphicPresetCapture';
const LOWER_THIRD_GRAPHIC_PRESET = new BuiltinGraphicPresetCatalog().starter();
const STARTER_GRAPHIC = LOWER_THIRD_GRAPHIC_PRESET.graphic;
import { GraphicBoxPlacement } from '@core/shots/domain/GraphicBoxPlacement';
import { ShotGraphicPresetSounds } from '@core/shots/services/ShotGraphicPresetSounds';
import { ShotGraphicPresetMotion } from '@core/shots/services/ShotGraphicPresetMotion';
import { ShotGraphicPresetApplier } from '@core/shots/services/ShotGraphicPresetApplier';
import { ShotElementSounds } from '@core/shots/services/ShotElementSounds';
import { ResetShotElementAction } from '@core/shots/actions/ResetShotElementAction';
import { RecordShotGraphicMomentsAction } from '@core/shots/actions/RecordShotGraphicMomentsAction';
import { GraphicSanitizer } from '@core/graphics/domain/GraphicSanitizer';
import { AddShotLayerAction } from '@core/shots/actions/AddShotLayerAction';
import { SetShotLayerPlacementAction } from '@core/shots/actions/SetShotLayerPlacementAction';
import { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { PatchShotLayersAction } from '@core/shots/actions/PatchShotLayersAction';
import { RemoveShotLayersAction } from '@core/shots/actions/RemoveShotLayersAction';
import { LastEditedPlacementRecorder } from '@core/shots/services/LastEditedPlacementRecorder';
import { ShotLayerPatcher } from '@core/shots/services/ShotLayerPatcher';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { ReplaceShotLayerFileAction } from '@core/shots/actions/ReplaceShotLayerFileAction';
import { SetShotLayerThroughAction } from '@core/shots/actions/SetShotLayerThroughAction';
import type { Shot } from '@core/shots/domain/Shot';
import { SetShotLayerTimingAction } from '@core/shots/actions/SetShotLayerTimingAction';
import { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import { SetShotLayerCssAction } from '@core/shots/actions/SetShotLayerCssAction';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import type { ElementAnimation } from '@core/elements/domain/ElementAnimation';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import type { MediaAssetType } from '@core/media/domain/MediaAssetType';
import { PICTURE_LAYER_PLACEMENT } from '@core/shots/domain/PictureLayerPlacement';
import { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';

/**
 * What an edit does to a partition nobody has committed to yet.
 *
 * The first edit is what makes the proposal the user's own, and from
 * then on nothing recomputes it — which is the whole reason a
 * transcript change can never move a shot somebody decided on.
 */

function editorWithSpeech(): EditorStore {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 24 },
  });
  return store;
}

/** Every file's original, its bytes being its id. */
class EchoingBytesRepository {
  load(mediaId: string): Promise<Blob | null> {
    return Promise.resolve(new Blob([mediaId]));
  }
}

/** Plays every GIF but the ones named. */
class NamedGifPlaybackProbe implements GifPlaybackProbe {
  constructor(private readonly unplayable: ReadonlySet<string>) {}

  async ensurePlayable(gif: Blob): Promise<void> {
    if (this.unplayable.has(await gif.text())) throw new Error('No decoder here can read this GIF.');
  }
}

/** Keeps each preset as the manifest it is stored as, so what it gives back is what reading that manifest gives. */
class ManifestKeepingPresetRepository implements SavedGraphicPresetRepository {
  private readonly manifests = new Map<string, Record<string, unknown>>();
  private readonly reader = new GraphicPresetManifestReader(new GraphicSanitizer(), new StoredGraphicPresetStyleReader());
  private readonly writer = new GraphicPresetManifestWriter();

  async list(): Promise<ReadonlyArray<GraphicPreset>> {
    return [...this.manifests.values()].reverse().flatMap((manifest) => this.reader.read(manifest, manifest['document']) ?? []);
  }

  async save(preset: GraphicPreset): Promise<void> {
    this.manifests.set(preset.id, JSON.parse(JSON.stringify(this.writer.write(preset))) as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    this.manifests.delete(id);
  }
}

function actionsFor(store: EditorStore, media = new MediaAssetStore(), unplayableGifs: ReadonlySet<string> = new Set()) {
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const preparer = new MediaAssetPreparer(
    new EchoingBytesRepository() as unknown as MediaAssetBytesRepository,
    {} as PreviewProxyGenerator,
    new DeviceOnlyMediaAssetUploader(),
    new NamedGifPlaybackProbe(unplayableGifs),
    { ensurePlayable: async () => undefined },
  );
  const playback = new ShotFilePlaybackCheck(media, preparer);
  const assets = new ShotLayerAssetReader();
  const lastEdited = new LastEditedPlacementRecorder(media, assets);
  const elementSounds = new ShotElementSounds();
  const presetSounds = new ShotGraphicPresetSounds(new AudioClipDefaults(), elementSounds);
  const presetMotion = new ShotGraphicPresetMotion(animationCatalog, animationCssWriter);
  const presetApplier = new ShotGraphicPresetApplier(layouts, new GraphicBoxPlacement(), presetSounds, presetMotion);
  const savedPresets = new SavedGraphicPresetStore();
  const presetRepository = new ManifestKeepingPresetRepository();
  const presetCatalog = new LibraryGraphicPresetCatalog(new BuiltinGraphicPresetCatalog(), savedPresets, new GraphicPresetMatcher());
  const telemetry = new RecordingShotTelemetry(presetCatalog);
  return {
    telemetry,
    savedPresets,
    presetRepository,
    presetCatalog,
    saveGraphicPreset: new SaveShotGraphicPresetAction(
      store, new ShotGraphicPresetCapture(new GraphicBoxPlacement()), presetRepository, savedPresets, new GraphicPresetNameValidator(), telemetry.graphics,
    ),
    split: new SplitShotAction(store, materializer, telemetry.edits),
    join: new JoinShotAction(store, materializer, telemetry.edits),
    moveStart: new MoveShotStartAction(store, materializer, telemetry.edits),
    repropose: new ReproposeShotsAction(store, telemetry.edits),
    addLayer: new AddShotLayerAction(store, materializer),
    addGraphic: new AddShotGraphicAction(store, materializer, presetApplier, telemetry.graphics),
    setGraphic: new SetShotGraphicAction(store, presetApplier, telemetry.graphics),
    reset: new ResetShotElementAction(
      store, materializer, media, assets, layouts, new ShotsOnlyLayoutFollower(), presetCatalog, presetApplier, elementSounds,
    ),
    showFile: new ShowFileOnShotAction(store, materializer, media, new ShotLayerAssetReader(), playback, layouts, new ShotsOnlyLayoutFollower(), telemetry.edits),
    setLayerPlacement: new SetShotLayerPlacementAction(store, layouts, lastEdited, new ShotsOnlyLayoutFollower(), telemetry.layoutChanges, telemetry.edits),
    patchLayers: new PatchShotLayersAction(
      store, media, assets, new ShotLayerPatcher(new ShotLayerPlacementSanitizer()), layouts, lastEdited, new ShotsOnlyLayoutFollower(), telemetry.layoutChanges, telemetry.edits,
    ),
    setLayerAnimation: new SetShotLayerAnimationAction(store, materializer, animationCatalog, animationCssWriter, telemetry.edits),
    setLayerCss: new SetShotLayerCssAction(store, materializer),
    setLayerInsetTransition: new SetShotLayerInsetTransitionAction(store, layoutFixture.catalog, layoutFixture.controls, new ShotLayerInsetTransitions()),
    setCamera: new SetShotCameraAction(
      store, materializer, layoutFixture.catalog, layoutFixture.controls, animationCatalog, animationCssWriter, new ShotCameraSounds(), new AudioClipDefaults(),
      media, new ShotLayerAssetReader(), new ShotLayerBoxShape(), telemetry.edits,
    ),
    removeLayers: new RemoveShotLayersAction(store, media, telemetry.edits),
    replaceFile: new ReplaceShotLayerFileAction(store, media, new ShotLayerAssetReader(), playback, telemetry.edits),
    setLayerTiming: new SetShotLayerTimingAction(store),
    setLayerThrough: new SetShotLayerThroughAction(store),
    setShotVideoVolume: new SetShotVideoVolumeAction(store, materializer),
    setFollow: new SetShotFollowAction(store, materializer),
  };
}

const ENTRANCE = ElementAnimationScope.ENTRANCE;
const EXIT = ElementAnimationScope.EXIT;
const layoutFixture = new TestShotLayerLayouts();
const layouts = layoutFixture.writer;
const animationCatalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const animationCssWriter = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
  animationCatalog,
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
));

function animationOf(store: EditorStore, layerId: string, scope: ElementAnimationScope): ElementAnimation | null {
  return store.snapshot().shots.layerStyles.animationOf(layerId, scope);
}

/** Every video runs 5 s, but where `durations` says otherwise. */
function mediaHolding(files: Record<string, MediaAssetType>, durations: Record<string, number> = {}): MediaAssetStore {
  const media = new MediaAssetStore();
  for (const [id, type] of Object.entries(files)) {
    media.put({
      id,
      type,
      owner: { kind: 'library' },
      fileName: id,
      mimeType: '',
      sizeBytes: 1,
      widthPx: 100,
      heightPx: 100,
      durationSec: type === 'video' ? durations[id] ?? 5 : null,
    });
  }
  return media;
}

const FULL = { kind: 'full', fit: 'cover' } as const;
const CLIP_LAYER: ShotLayer = { id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false };
const INSET = {
  kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.4, aspectRatio: null, padding: 0.04, cornerRadius: 0.04, fit: 'cover',
} as const;

describe('editing the shot partition', async () => {
  it('holds nothing until an edit asks it to', async () => {
    const store = editorWithSpeech();

    expect(store.snapshot().shots.isEmpty()).toBe(true);
  });

  it('keeps the proposal, plus the new opening, on the first split', async () => {
    const store = editorWithSpeech();
    const proposed = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot());

    actionsFor(store).split.execute(7);

    const kept = store.snapshot().shots.list().map((shot) => shot.startSec);
    expect(kept).toEqual([...proposed.list().map((shot) => shot.startSec), 7].sort((a, b) => a - b));
  });

  it('puts a graphic on top of a proposed shot, low in the frame, in one undo step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;

    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET);

    const shots = store.snapshot().shots;
    expect(layerId).not.toBeNull();
    expect(shots.findLayer(layerId!)).toEqual({ id: layerId, graphic: STARTER_GRAPHIC });
    expect(shots.shotHolding(layerId!)?.id).toBe(shotId);
    expect(shots.placementOf(layerId!)).toEqual(new GraphicBoxPlacement().placementOf(LOWER_THIRD_GRAPHIC_PRESET.box));
    store.undo();
    expect(store.snapshot().shots.isEmpty()).toBe(true);
  });

  it('edits a graphic: a run of typing in one field is one undo step, a value of another type is refused, and a preset lays it out anew', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;
    const graphic = () => {
      const layer = store.snapshot().shots.findLayer(layerId);
      return layer !== null && 'graphic' in layer ? layer.graphic : null;
    };

    actions.setGraphic.setParam(layerId, 'title', 'A');
    actions.setGraphic.setParam(layerId, 'title', 'Ad');
    actions.setGraphic.setParam(layerId, 'title', 'Ada');
    actions.setGraphic.setParam(layerId, 'title', 7);
    actions.setGraphic.setParam(layerId, 'nothing', 'x');
    expect(graphic()?.params).toEqual({ title: 'Ada' });
    store.undo();
    expect(graphic()?.params).toEqual({});

    actions.setGraphic.setDocument(layerId, 'js', 'tscaps.render = () => {};');
    expect(graphic()?.document).toEqual({ ...LOWER_THIRD_GRAPHIC_PRESET.graphic.document, js: 'tscaps.render = () => {};' });

    actions.setGraphic.applyPreset(layerId, { ...LOWER_THIRD_GRAPHIC_PRESET, box: { kind: 'full' } });
    expect(graphic()).toEqual(LOWER_THIRD_GRAPHIC_PRESET.graphic);
    expect(store.snapshot().shots.placementOf(layerId).kind).toBe('full');
  });

  it('starts a graphic over as its preset ships, picked again or another: its sounds, its code and its CSS, in one undo step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const follow = { ...LOWER_THIRD_GRAPHIC_PRESET, id: 'follow', sounds: [{ spot: { kind: 'moment' as const, momentId: 'press' }, soundId: 'click-mouse', volume: 0.6, offsetSec: 0 }] };
    const comment = { ...LOWER_THIRD_GRAPHIC_PRESET, id: 'comment', sounds: [{ spot: { kind: 'moment' as const, momentId: 'like' }, soundId: 'pop-bubble', volume: 0.5, offsetSec: 0 }] };
    const layerId = actions.addGraphic.execute(shotId, follow)!;
    const placed = () => store.snapshot().audio.clips().map(({ source, start: { anchor }, volume }) => [anchor, source, volume]);
    const graphic = () => {
      const layer = store.snapshot().shots.findLayer(layerId);
      return layer !== null && 'graphic' in layer ? layer.graphic : null;
    };
    const css = () => store.snapshot().shots.layerStyles.get(layerId)?.css ?? '';

    expect(placed()).toEqual([[{ kind: 'layer-moment', layerId, momentId: 'press' }, { kind: 'builtin', soundId: 'click-mouse' }, 0.6]]);

    store.patch({ audio: store.snapshot().audio.withClipAdded(new AudioClipDefaults().clipFrom('edge', {
      role: 'effect', source: { kind: 'builtin', soundId: 'swish' }, start: { anchor: { kind: 'layer', layerId, edge: 'entry' }, offsetSec: 0 },
    })) });
    actions.setGraphic.setDocument(layerId, 'js', 'tscaps.render = () => {};');
    actions.setGraphic.setParam(layerId, 'title', 'Ada');
    actions.setLayerCss.execute(layerId, `${css()}\nopacity: 0.5;`);
    actions.setGraphic.applyPreset(layerId, follow);

    expect(placed()).toEqual([[{ kind: 'layer-moment', layerId, momentId: 'press' }, { kind: 'builtin', soundId: 'click-mouse' }, 0.6]]);
    expect(graphic()?.document).toEqual(follow.graphic.document);
    expect(graphic()?.params).toEqual({});
    expect(css()).not.toContain('opacity: 0.5');

    actions.setGraphic.applyPreset(layerId, comment);
    expect(placed()).toEqual([[{ kind: 'layer-moment', layerId, momentId: 'like' }, { kind: 'builtin', soundId: 'pop-bubble' }, 0.5]]);
    store.undo();
    expect(placed().map(([anchor]) => anchor)).toEqual([{ kind: 'layer-moment', layerId, momentId: 'press' }]);
  });

  it('resets a graphic to the preset it started from, its code edited or not', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;
    const graphic = () => {
      const layer = store.snapshot().shots.findLayer(layerId);
      return layer !== null && 'graphic' in layer ? layer.graphic : null;
    };

    actions.setGraphic.setDocument(layerId, 'html', '<p>Mine</p>');
    actions.setGraphic.setParam(layerId, 'title', 'Ada');
    actions.setLayerAnimation.pick([layerId], ENTRANCE, 'layer-pop-entrance');
    actions.reset.resetLayer(layerId);

    expect(graphic()?.document).toEqual(LOWER_THIRD_GRAPHIC_PRESET.graphic.document);
    expect(graphic()?.params).toEqual({});
    expect(graphic()?.presetId).toBe(LOWER_THIRD_GRAPHIC_PRESET.id);
    expect(animationOf(store, layerId, ENTRANCE)).toBeNull();
  });

  it('saves a graphic as a preset as it stands, which starts another graphic the same and is what the first resets to', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;
    const graphicOf = (id: string) => {
      const layer = store.snapshot().shots.findLayer(id);
      return layer !== null && 'graphic' in layer ? layer.graphic : null;
    };
    const soundsOf = (id: string) => store.snapshot().audio.clips()
      .filter(({ start: { anchor } }) => 'layerId' in anchor && anchor.layerId === id)
      .map(({ source, start, volume }) => [{ ...start.anchor, layerId: 'layer' }, start.offsetSec, source, volume]);
    const withSound = (id: string, source: AudioSourceRef, anchor: AudioAnchor, offsetSec: number) => store.patch({
      audio: store.snapshot().audio.withClipAdded(new AudioClipDefaults().clipFrom(id, { role: 'effect', source, start: { anchor, offsetSec }, volume: 0.4 })),
    });

    actions.setGraphic.setDocument(layerId, 'html', '<p>Mine</p>');
    actions.setGraphic.setParam(layerId, 'title', 'Ada');
    actions.setLayerAnimation.pick([layerId], ENTRANCE, 'layer-pop-entrance');
    actions.setLayerInsetTransition.setKind([layerId], 'entrance', 'full');
    actions.setLayerInsetTransition.setDurationSec([layerId], 'entrance', 0.9);
    actions.setCamera.pick({ kind: 'layer', layerId }, 'layer-fast-zoom-in-camera');
    actions.setLayerCss.execute(layerId, `${store.snapshot().shots.layerStyles.get(layerId)?.css ?? ''}\nopacity: 0.5;`);
    withSound('swish', { kind: 'builtin', soundId: 'swish' }, { kind: 'layer', layerId, edge: 'entry' }, -0.2);
    withSound('press', { kind: 'builtin', soundId: 'click-mouse' }, { kind: 'layer-moment', layerId, momentId: 'press' }, 0);
    withSound('from-frame', { kind: 'builtin', soundId: 'whoosh-fast' }, { kind: 'layer-transition', layerId, edge: 'entrance' }, -0.1);
    withSound('own-file', { kind: 'media', mediaId: 'my-recording' }, { kind: 'layer', layerId, edge: 'exit' }, 0);
    const styleThen = store.snapshot().shots.layerStyles.get(layerId);
    const bundledSoundsThen = soundsOf(layerId).filter(([, , source]) => (source as AudioSourceRef).kind === 'builtin');

    await expect(actions.saveGraphicPreset.execute(layerId, '   ')).rejects.toThrow();
    const saved = (await actions.saveGraphicPreset.execute(layerId, '  Mine  '))!;

    expect(saved.name).toBe('Mine');
    expect(actions.savedPresets.snapshot()).toEqual([saved]);
    expect(await actions.presetRepository.list()).toEqual([saved]);
    expect(graphicOf(layerId)?.presetId).toBe(saved.id);
    expect(actions.presetCatalog.presetOf(graphicOf(layerId)!)).toBe(saved);

    const copyId = actions.addGraphic.execute(shotId, saved)!;
    expect(graphicOf(copyId)?.document.html).toBe('<p>Mine</p>');
    expect(graphicOf(copyId)?.fields.find((field) => field.id === 'title')?.defaultValue).toBe('Ada');
    // The whole style: the entrance, the box's way in from the whole frame and its length, the camera, the CSS by hand.
    expect(store.snapshot().shots.layerStyles.get(copyId)).toEqual(styleThen);
    expect(animationOf(store, copyId, ENTRANCE)?.presetId).toBe('layer-pop-entrance');
    expect(store.snapshot().shots.layerStyles.get(copyId)?.css).toContain('opacity: 0.5');
    expect(new Set(soundsOf(copyId).map((sound) => JSON.stringify(sound)))).toEqual(new Set(bundledSoundsThen.map((sound) => JSON.stringify(sound))));
    expect(bundledSoundsThen.map(([anchor]) => (anchor as AudioAnchor).kind).sort()).toEqual(['layer', 'layer-camera', 'layer-moment', 'layer-transition']);

    actions.setGraphic.setDocument(layerId, 'html', '<p>Edited again</p>');
    actions.reset.resetLayer(layerId);
    expect(graphicOf(layerId)?.document.html).toBe('<p>Mine</p>');
    expect(graphicOf(layerId)?.params).toEqual({});
  });

  it('saves a graphic over the saved preset it was made from, keeping its name, and writes over no shipped one', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;

    expect(await actions.saveGraphicPreset.overwrite(layerId)).toBeNull();
    actions.setLayerAnimation.pick([layerId], ENTRANCE, 'layer-pop-entrance');
    const saved = (await actions.saveGraphicPreset.execute(layerId, 'Mine'))!;
    actions.setLayerAnimation.pick([layerId], ENTRANCE, 'layer-fade-entrance');
    actions.setLayerInsetTransition.setKind([layerId], 'entrance', 'full');
    const overwritten = (await actions.saveGraphicPreset.overwrite(layerId))!;

    expect([overwritten.id, overwritten.name]).toEqual([saved.id, 'Mine']);
    expect(actions.savedPresets.snapshot()).toEqual([overwritten]);
    expect(await actions.presetRepository.list()).toEqual([overwritten]);
    const copyId = actions.addGraphic.execute(shotId, overwritten)!;
    expect(animationOf(store, copyId, ENTRANCE)?.presetId).toBe('layer-fade-entrance');
    expect(store.snapshot().shots.layerStyles.get(copyId)).toEqual(store.snapshot().shots.layerStyles.get(layerId));
  });

  it('resets a file layer to how a layer of its kind starts: its fresh layout, its whole file, no motion, CSS or sound', async () => {
    const media = mediaHolding({ clip: 'video' });
    const store = editorWithSpeech();
    const actions = actionsFor(store, media);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    await actions.showFile.execute(shotId, 'clip', 'shot-picker');
    const layerId = store.snapshot().shots.list()[0]!.layers[0]!.id;
    actions.setLayerPlacement.execute(layerId, INSET);
    actions.setLayerAnimation.pick([layerId], EXIT, 'layer-fade-exit');
    actions.setLayerCss.execute(layerId, `${store.snapshot().shots.layerStyles.get(layerId)?.css ?? ''}\nopacity: 0.5;`);
    store.patch({ audio: store.snapshot().audio.withFootageSound([layerId], 1).withClipAdded(new AudioClipDefaults().clipFrom('edge', {
      role: 'effect', source: { kind: 'builtin', soundId: 'swish' }, start: { anchor: { kind: 'layer', layerId, edge: 'entry' }, offsetSec: 0 },
    })) });

    actions.reset.resetLayer(layerId);

    expect(store.snapshot().shots.placementOf(layerId).kind).toBe('full');
    expect(animationOf(store, layerId, EXIT)).toBeNull();
    expect(store.snapshot().shots.layerStyles.get(layerId)?.css ?? '').not.toContain('opacity');
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(store.snapshot().audio.footageSounds()).toEqual([]);
    store.undo();
    expect(store.snapshot().shots.placementOf(layerId).kind).toBe('inset');
  });

  it('resets a shot: no camera, no CSS, the video at its level, and none of its own sounds, words\' kept', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const videoLayerId = ShotVideoLayerId.of(shotId);
    actions.setLayerCss.execute(videoLayerId, 'filter: grayscale(1);');
    const clip = (id: string, anchor: AudioClip['start']['anchor']) => new AudioClipDefaults().clipFrom(id, {
      role: 'effect', source: { kind: 'builtin', soundId: 'swish' }, start: { anchor, offsetSec: 0 },
    });
    const wordId = store.snapshot().document!.getWords()[0]!.id;
    store.patch({ audio: store.snapshot().audio
      .withClipAdded(clip('on-start', { kind: 'shot', shotId, edge: 'start' }))
      .withClipAdded(clip('on-word', { kind: 'word', wordId, edge: 'start' }))
      .withShotVideoVolume([shotId], 0) });

    actions.reset.resetShot(shotId);

    expect(store.snapshot().shots.layerStyles.get(videoLayerId)).toBeNull();
    expect(store.snapshot().audio.clips().map((held) => held.id)).toEqual(['on-word']);
    expect(store.snapshot().audio.shotVideoVolumes().get(shotId) ?? 1).toBe(1);
  });

  it('gives a graphic the motion its preset recommends, none where it recommends none, whatever was picked before', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;
    const motion = () => [ENTRANCE, EXIT].map((scope) => store.snapshot().shots.layerStyles.animationOf(layerId, scope)?.presetId ?? null);
    const css = () => store.snapshot().shots.layerStyles.get(layerId)?.css ?? '';

    actions.setLayerAnimation.pick([layerId], ENTRANCE, 'layer-pop-entrance');
    actions.setLayerAnimation.pick([layerId], EXIT, 'layer-slide-exit');
    actions.setLayerAnimation.setParam([layerId], EXIT, 'duration', 1.2);
    actions.setGraphic.applyPreset(layerId, {
      ...LOWER_THIRD_GRAPHIC_PRESET,
      motion: { entrance: null, exit: { presetId: 'layer-fade-exit', params: { duration: 9, nothing: 1 } } },
    });

    expect(motion()).toEqual([null, 'layer-fade-exit']);
    expect(store.snapshot().shots.layerStyles.animationOf(layerId, EXIT)?.params).toEqual({ duration: 2 });
    expect(css()).not.toContain('layer-pop');
    expect(css()).not.toContain('layer-slide');

    actions.setGraphic.applyPreset(layerId, { ...LOWER_THIRD_GRAPHIC_PRESET, motion: { entrance: null, exit: null } });
    expect(motion()).toEqual([null, null]);
    expect(css()).not.toContain('layer-fade');
  });

  it('keeps the moments a graphic knows when the preset picked again is the code it already shows', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
    const layerId = actions.addGraphic.execute(shotId, LOWER_THIRD_GRAPHIC_PRESET)!;
    const moments = [{ id: 'press', label: 'Button pressed', sec: 1.3 }];
    new RecordShotGraphicMomentsAction(store, new GraphicSanitizer()).record(layerId, LOWER_THIRD_GRAPHIC_PRESET.graphic, moments);
    const momentsOf = () => {
      const layer = store.snapshot().shots.findLayer(layerId);
      return layer !== null && 'graphic' in layer ? layer.graphic.moments : null;
    };

    actions.setGraphic.setParam(layerId, 'title', 'Ada');
    actions.setGraphic.applyPreset(layerId, LOWER_THIRD_GRAPHIC_PRESET);
    expect(momentsOf()).toEqual(moments);

    actions.setGraphic.applyPreset(layerId, { ...LOWER_THIRD_GRAPHIC_PRESET, graphic: { ...LOWER_THIRD_GRAPHIC_PRESET.graphic, document: { html: '', css: '', js: '' } } });
    expect(momentsOf()).toEqual([]);
  });

  it("sets a proposed shot's video level by making the partition real, keeping the id it showed, in one undo step", async () => {
    const store = editorWithSpeech();
    const proposed = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[1]!;

    actionsFor(store).setShotVideoVolume.execute([proposed.id], 0);

    expect(store.snapshot().shots.list().map((shot) => shot.id)).toContain(proposed.id);
    expect(store.snapshot().audio.shotVideoVolumeOf(proposed.id)).toBe(0);
    store.undo();
    expect(store.snapshot().shots.isEmpty()).toBe(true);
    expect(store.snapshot().audio.hasShotVideoVolumes()).toBe(false);
  });

  it("gives both halves of a shot it splits that shot's video level, and leaves other shots at full", async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const muted = store.snapshot().shots.at(7)!;
    actions.setShotVideoVolume.execute([muted.id], 0.4);

    actions.split.execute(7.5);
    actions.split.execute(1);

    const halves = store.snapshot().shots.list().filter((shot) => shot.startSec === 7 || shot.startSec === 7.5);
    expect(halves.map((shot) => store.snapshot().audio.shotVideoVolumeOf(shot.id))).toEqual([0.4, 0.4]);
    expect(store.snapshot().audio.shotVideoVolumeOf(store.snapshot().shots.at(1)!.id)).toBe(1);
  });

  it('leaves the partition alone when a transcript edit comes after it', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const before = store.snapshot().shots.list();

    store.patch({ document: new Document({ sections: [] }) });

    expect(store.snapshot().shots.list()).toEqual(before);
  });

  it('gives every edit back to undo', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);

    actions.split.execute(7);
    const afterSplit = store.snapshot().shots.list().length;
    actions.join.execute(store.snapshot().shots.list()[1]!.id);
    expect(store.snapshot().shots.list().length).toBe(afterSplit - 1);

    store.undo();
    expect(store.snapshot().shots.list().length).toBe(afterSplit);
  });

  it('moves an opening without minting a new shot', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const moved = store.snapshot().shots.list()[1]!;

    actions.moveStart.execute(moved.id, moved.startSec + 0.5);

    const after = store.snapshot().shots.list()[1]!;
    expect(after.id).toBe(moved.id);
    expect(after.startSec).toBe(moved.startSec + 0.5);
  });

  it('gives a drag back to undo as one step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const moved = store.snapshot().shots.list()[1]!;

    actions.moveStart.execute(moved.id, moved.startSec + 0.1);
    actions.moveStart.execute(moved.id, moved.startSec + 0.2);
    actions.moveStart.execute(moved.id, moved.startSec + 0.3);
    store.undo();

    expect(store.snapshot().shots.list()[1]!.startSec).toBe(moved.startSec);
  });

  it('throws the edits away only when asked to propose again', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);

    actions.repropose.execute(10);

    expect(store.snapshot().shots.isEmpty()).toBe(true);
    expect(store.snapshot().shots.maxShotSec).toBe(10);
  });

  it('makes the proposal the user\'s own when a shot is given a layer', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const target = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[1]!;

    actions.addLayer.execute(target.id, CLIP_LAYER);
    store.patch({ document: new Document({ sections: [] }) });

    const kept = store.snapshot().shots.list().find((shot) => shot.id === target.id);
    expect(kept?.layers.map((layer) => (layer as ShotFileLayer).mediaId)).toEqual(['clip']);
  });

  it('starts a new layer where the last layer of its role edited was left, and moves no layer already there', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video', third: 'video', logo: 'image', wave: 'gif' }));
    actions.split.execute(7);
    actions.split.execute(13);
    const [first, second, third] = store.snapshot().shots.list();
    await actions.showFile.execute(first!.id, 'clip', 'shot-picker');
    await actions.showFile.execute(first!.id, 'logo', 'shot-picker');
    await actions.showFile.execute(second!.id, 'other', 'shot-picker');
    const [broll, picture] = store.snapshot().shots.list()[0]!.layers;
    const split = { kind: 'split', assetSide: 'start', assetRatio: 0.5, padding: 0, cornerRadius: 0, fit: 'cover' } as const;

    actions.setLayerPlacement.execute(broll!.id, INSET);
    actions.setLayerPlacement.execute(picture!.id, split);
    await actions.showFile.execute(third!.id, 'third', 'shot-picker');
    await actions.showFile.execute(third!.id, 'wave', 'shot-picker');

    const shots = store.snapshot().shots;
    expect(shots.placementOf(shots.list()[1]!.layers[0]!.id)).toEqual(FULL);
    expect(shots.list()[2]!.layers.map((held) => shots.placementOf(held.id))).toEqual([INSET, split]);
  });

  it('starts a new layer fresh until a layer of its role is edited, whatever the other role was given', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', logo: 'image' }));
    actions.split.execute(7);
    const [first, second] = store.snapshot().shots.list();
    await actions.showFile.execute(first!.id, 'clip', 'shot-picker');
    actions.setLayerPlacement.execute(store.snapshot().shots.list()[0]!.layers[0]!.id, INSET);

    await actions.showFile.execute(second!.id, 'logo', 'shot-picker');

    expect(store.snapshot().shots.placementOf(store.snapshot().shots.list()[1]!.layers[0]!.id)).toEqual(PICTURE_LAYER_PLACEMENT);
  });

  it('takes back what a new layer starts with along with the edit that set it, in one undo step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video' }));
    actions.split.execute(7);
    await actions.showFile.execute(store.snapshot().shots.list()[0]!.id, 'clip', 'shot-picker');

    actions.setLayerPlacement.execute(store.snapshot().shots.list()[0]!.layers[0]!.id, INSET);
    store.undo();

    expect(store.snapshot().shots.placementForNewLayer('video')).toEqual(FULL);
  });

  it('remembers nothing for a layer whose file is gone, having no role', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({}));
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, { ...CLIP_LAYER, id: 'gone', mediaId: 'deleted' });

    actions.setLayerPlacement.execute('gone', INSET);

    expect(store.snapshot().shots.placementOf('gone')).toEqual(INSET);
    expect(store.snapshot().shots.placementForNewLayer('video')).toEqual(FULL);
  });

  it('gives a drag of a layer\'s placement back to undo as one step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);

    actions.setLayerPlacement.execute(CLIP_LAYER.id, { ...INSET, centerX: 0.3 });
    actions.setLayerPlacement.execute(CLIP_LAYER.id, { ...INSET, centerX: 0.4 });
    actions.setLayerPlacement.execute(CLIP_LAYER.id, { ...INSET, centerX: 0.5 });
    store.undo();

    expect(store.snapshot().shots.placementOf(store.snapshot().shots.list()[0]!.layers[0]!.id)).toEqual(FULL);
  });

  it('shows a file in place of the shot\'s first, keeping where it sits, even when that layer came after the file was asked for', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ first: 'video', second: 'video' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    await actions.showFile.execute(shotId, 'first', 'shot-picker');
    const layer = store.snapshot().shots.list()[0]!.layers[0]!;
    actions.setLayerPlacement.execute(layer.id, INSET);

    await actions.showFile.execute(shotId, 'second', 'shot-picker');

    const layers = store.snapshot().shots.list()[0]!.layers;
    expect(layers.map((held) => [held.id, (held as ShotFileLayer).mediaId, store.snapshot().shots.placementOf(held.id)])).toEqual([[layer.id, 'second', INSET]]);
  });

  it('puts a picture or a GIF on top of what the shot shows, each placed as its role starts, replacing nothing', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', logo: 'image', wave: 'gif' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;

    await actions.showFile.execute(shotId, 'clip', 'shot-picker');
    await actions.showFile.execute(shotId, 'logo', 'shot-picker');
    await actions.showFile.execute(shotId, 'wave', 'shot-picker');

    const layers = store.snapshot().shots.list()[0]!.layers;
    expect(layers.map((held) => [(held as ShotFileLayer).mediaId, store.snapshot().shots.placementOf(held.id)])).toEqual([
      ['clip', FULL],
      ['logo', PICTURE_LAYER_PLACEMENT],
      ['wave', PICTURE_LAYER_PLACEMENT],
    ]);
  });

  it('shows a video in place of the shot\'s video, wherever that layer stands, and leaves its pictures alone', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ first: 'video', second: 'video', logo: 'image' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    actions.addLayer.execute(shotId, { ...CLIP_LAYER, id: 'picture', mediaId: 'logo' });
    actions.addLayer.execute(shotId, { ...CLIP_LAYER, id: 'broll', mediaId: 'first' });

    await actions.showFile.execute(shotId, 'second', 'shot-picker');

    const layers = store.snapshot().shots.list()[0]!.layers;
    expect(layers.map((held) => [held.id, (held as ShotFileLayer).mediaId])).toEqual([['picture', 'logo'], ['broll', 'second']]);
  });

  it('puts a video beneath the pictures of a shot that has no video yet', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', logo: 'image' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    await actions.showFile.execute(shotId, 'logo', 'shot-picker');

    await actions.showFile.execute(shotId, 'clip', 'shot-picker');

    expect(store.snapshot().shots.list()[0]!.layers.map((held) => (held as ShotFileLayer).mediaId)).toEqual(['clip', 'logo']);
  });

  it('puts a new b-roll beneath a layer whose file is gone, rather than in its place, and shows nothing for a file it does not know', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    actions.addLayer.execute(shotId, { ...CLIP_LAYER, id: 'gone', mediaId: 'deleted' });

    await actions.showFile.execute(shotId, 'clip', 'shot-picker');
    await actions.showFile.execute(shotId, 'unknown', 'shot-picker');

    expect(store.snapshot().shots.list()[0]!.layers.map((held) => (held as ShotFileLayer).mediaId)).toEqual(['clip', 'deleted']);
  });

  it('shows another file on a layer, keeping where it sits and starting its stretch over', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video' }));
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[1]!.id, { ...CLIP_LAYER, inSec: 2, outSec: 4, loop: true });
    actions.setLayerPlacement.execute(CLIP_LAYER.id, INSET);

    await actions.replaceFile.execute(CLIP_LAYER.id, 'other');

    expect(store.snapshot().shots.findLayer(CLIP_LAYER.id)).toEqual({ id: CLIP_LAYER.id, mediaId: 'other', inSec: 0, outSec: null, loop: false });
    expect(store.snapshot().shots.placementOf(CLIP_LAYER.id)).toEqual(INSET);
    store.undo();
    expect((store.snapshot().shots.findLayer(CLIP_LAYER.id) as ShotFileLayer | null)?.mediaId).toBe('clip');
  });

  it('keeps a layer\'s role: a b-roll takes no picture, a picture no video', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video', logo: 'image', wave: 'gif' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    actions.addLayer.execute(shotId, CLIP_LAYER);
    actions.addLayer.execute(shotId, { ...CLIP_LAYER, id: 'picture', mediaId: 'logo' });

    await actions.replaceFile.execute(CLIP_LAYER.id, 'logo');
    await actions.replaceFile.execute('picture', 'other');
    expect(store.snapshot().shots.list()[0]!.layers.map((held) => (held as ShotFileLayer).mediaId)).toEqual(['clip', 'logo']);

    await actions.replaceFile.execute('picture', 'wave');
    expect((store.snapshot().shots.findLayer('picture') as ShotFileLayer | null)?.mediaId).toBe('wave');
  });

  it('refuses by name a GIF this browser cannot play, on a shot or in place of a layer\'s file, changing nothing', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ logo: 'image', wave: 'gif', spin: 'gif' }), new Set(['spin']));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    await actions.showFile.execute(shotId, 'wave', 'shot-picker');
    const before = store.snapshot().shots;
    const picture = before.list()[0]!.layers[0]!;

    await expect(actions.showFile.execute(shotId, 'spin', 'shot-picker')).rejects.toMatchObject({ name: 'ShotFileShowFailedError' });
    await expect(actions.replaceFile.execute(picture.id, 'spin')).rejects.toMatchObject({ name: 'ShotFileShowFailedError' });

    expect(store.snapshot().shots).toBe(before);
    await actions.replaceFile.execute(picture.id, 'logo');
    expect((store.snapshot().shots.findLayer(picture.id) as ShotFileLayer | null)?.mediaId).toBe('logo');
  });

  it('gives a drag of a layer\'s stretch back to undo as one step, and reads an end before the start as the file\'s end', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);

    actions.setLayerTiming.execute(CLIP_LAYER.id, { inSec: 1, outSec: 3, loop: false });
    actions.setLayerTiming.execute(CLIP_LAYER.id, { inSec: 2, outSec: 1, loop: true });

    const layer = store.snapshot().shots.findLayer(CLIP_LAYER.id) as ShotFileLayer | null;
    expect([layer?.inSec, layer?.outSec, layer?.loop]).toEqual([2, null, true]);
    store.undo();
    expect((store.snapshot().shots.findLayer(CLIP_LAYER.id) as ShotFileLayer | null)?.inSec).toBe(0);
  });

  it('shows a layer through later shots, and gives picking one shot after another back to undo as one step', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const [first, second, third] = store.snapshot().shots.list().map((shot) => shot.id) as [string, string, string];
    actions.addLayer.execute(first, CLIP_LAYER);
    const shownOn = () => store.snapshot().shots.runOf(CLIP_LAYER.id).map((shot) => shot.id);

    actions.setLayerThrough.execute(CLIP_LAYER.id, second);
    actions.setLayerThrough.execute(CLIP_LAYER.id, third);

    expect(shownOn()).toEqual([first, second, third]);
    store.undo();
    expect(shownOn()).toEqual([first]);
  });

  it('keeps how far a layer shows when a shot is opened inside it and when it is given another file', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video' }));
    actions.split.execute(7);
    const [first, second, third] = store.snapshot().shots.list() as [Shot, Shot, Shot];
    actions.addLayer.execute(first.id, CLIP_LAYER);
    actions.setLayerThrough.execute(CLIP_LAYER.id, third.id);

    actions.split.execute((second.startSec + third.startSec) / 2);
    await actions.replaceFile.execute(CLIP_LAYER.id, 'other');

    const run = store.snapshot().shots.runOf(CLIP_LAYER.id);
    expect(run).toHaveLength(4);
    expect([run[0]!.id, run.at(-1)!.id]).toEqual([first.id, third.id]);
    expect((store.snapshot().shots.findLayer(CLIP_LAYER.id) as ShotFileLayer).mediaId).toBe('other');
  });

  it('leaves a layer on the same stretch of the video when its own shot is split', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const [first, second] = store.snapshot().shots.list();
    actions.addLayer.execute(first!.id, CLIP_LAYER);

    actions.split.execute(second!.startSec / 2);

    const run = store.snapshot().shots.runOf(CLIP_LAYER.id);
    expect(run.map((shot) => shot.startSec)).toEqual([0, second!.startSec / 2]);
    expect(store.snapshot().shots.list()[2]!.id).toBe(second!.id);
  });

  it('gives a drag of a layer\'s entrance duration back to undo as one step, its exit untouched', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], EXIT, 'layer-fade-exit');
    actions.setLayerAnimation.setParam([CLIP_LAYER.id], EXIT, 'duration', 0.4);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-pop-entrance');

    for (const duration of [0.3, 0.6, 0.9]) {
      actions.setLayerAnimation.setParam([CLIP_LAYER.id], ENTRANCE, 'duration', duration);
    }

    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)).toEqual({ presetId: 'layer-pop-entrance', params: { duration: 0.9 } });
    expect(animationOf(store, CLIP_LAYER.id, EXIT)).toEqual({ presetId: 'layer-fade-exit', params: { duration: 0.4 } });
    store.undo();
    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)).toEqual({ presetId: 'layer-pop-entrance', params: {} });
    expect(animationOf(store, CLIP_LAYER.id, EXIT)).toEqual({ presetId: 'layer-fade-exit', params: { duration: 0.4 } });
  });

  it('gives picking another preset an undo step of its own, at that preset\'s own values, and picking the same one keeps them', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-slide-entrance');
    actions.setLayerAnimation.setParam([CLIP_LAYER.id], ENTRANCE, 'duration', 1.2);
    actions.setLayerAnimation.setParam([CLIP_LAYER.id], ENTRANCE, 'direction', '270deg');

    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-slide-entrance');
    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)).toEqual({ presetId: 'layer-slide-entrance', params: { duration: 1.2, direction: '270deg' } });

    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-wipe-entrance');
    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)).toEqual({ presetId: 'layer-wipe-entrance', params: {} });
    store.undo();

    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)?.presetId).toBe('layer-slide-entrance');
  });

  it('writes a field as its preset allows: within range, and nowhere for a field it does not offer or a preset that is gone', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-slide-entrance');

    actions.setLayerAnimation.setParam([CLIP_LAYER.id], ENTRANCE, 'duration', 9);
    actions.setLayerAnimation.setParam([CLIP_LAYER.id], ENTRANCE, 'stray', 1);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], EXIT, 'layer-teleport-exit');

    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)).toEqual({ presetId: 'layer-slide-entrance', params: { duration: 2 } });
    expect(animationOf(store, CLIP_LAYER.id, EXIT)).toBeNull();
  });

  it('writes what was picked into the layer\'s own CSS, and takes it back out with none', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-spin-entrance');

    const style = store.snapshot().shots.layerStyles.get(CLIP_LAYER.id)!;
    expect(animationCssWriter.isTakenOver(style.css, 'layer', ENTRANCE, style.animations![ENTRANCE]!)).toBe(false);

    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, null);
    expect(store.snapshot().shots.layerStyles.get(CLIP_LAYER.id)).toBeNull();
  });

  it('keeps a layer\'s motion when another file takes its place', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video' }));
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerAnimation.pick([CLIP_LAYER.id], ENTRANCE, 'layer-slide-entrance');

    await actions.replaceFile.execute(CLIP_LAYER.id, 'other');

    expect(animationOf(store, CLIP_LAYER.id, ENTRANCE)?.presetId).toBe('layer-slide-entrance');
  });

  it('starts a new layer with no motion, and leaves motion out of a patch of placements', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video' }));
    actions.split.execute(7);
    const [first, second] = store.snapshot().shots.list();
    await actions.showFile.execute(first!.id, 'clip', 'shot-picker');
    await actions.showFile.execute(second!.id, 'other', 'shot-picker');
    const [moving, still] = [first!, second!].map((shot) => store.snapshot().shots.list().find((held) => held.id === shot.id)!.layers[0]!);
    actions.setLayerAnimation.pick([moving!.id], ENTRANCE, 'layer-fade-entrance');

    actions.patchLayers.execute([moving!.id, still!.id], { placement: { layout: 'inset' } });

    expect(store.snapshot().shots.placementOf(still!.id)).toEqual(INSET);
    expect(animationOf(store, still!.id, ENTRANCE)).toBeNull();
    expect(animationOf(store, moving!.id, ENTRANCE)?.presetId).toBe('layer-fade-entrance');
  });
});

/**
 * Several layers edited together. The promise is that only what the
 * user changed reaches every layer: whatever else differs between them
 * stays as it was, which copying one layer's placement onto the rest
 * would not keep.
 */
describe('editing several layers together', () => {
  /** The first three shots, a b-roll on each, placed in boxes at three different places; and a picture on the first. */
  async function threeBrolls(durations: Record<string, number> = {}) {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ a: 'video', b: 'video', c: 'video', logo: 'image' }, durations));
    actions.split.execute(7);
    actions.split.execute(13);
    const shots = store.snapshot().shots.list();
    for (const [index, mediaId] of ['a', 'b', 'c'].entries()) await actions.showFile.execute(shots[index]!.id, mediaId, 'shot-picker');
    await actions.showFile.execute(shots[0]!.id, 'logo', 'shot-picker');
    const ids = store.snapshot().shots.list().slice(0, 3).map((shot) => shot.layers[0]!.id);
    for (const [index, id] of ids.entries()) actions.setLayerPlacement.execute(id, { ...INSET, centerX: 0.2 + index * 0.3 });
    const pictureId = store.snapshot().shots.list()[0]!.layers[1]!.id;
    return {
      store,
      actions,
      ids,
      pictureId,
      layer: (id: string) => store.snapshot().shots.findLayer(id) as ShotFileLayer,
      placement: (id: string) => store.snapshot().shots.placementOf(id),
    };
  }

  it('writes only the field changed into every layer, across the shots, and leaves what else differs', async () => {
    const { actions, ids, placement } = await threeBrolls();

    actions.patchLayers.execute(ids, { placement: { settings: { width: 0.6 } } });

    expect(ids.map((id) => placement(id))).toEqual([
      { ...INSET, centerX: 0.2, width: 0.6 },
      { ...INSET, centerX: 0.5, width: 0.6 },
      { ...INSET, centerX: 0.8, width: 0.6 },
    ]);
  });

  it('touches no layer it was not given', async () => {
    const { actions, ids, pictureId, layer, placement } = await threeBrolls();
    const picture = layer(pictureId);

    actions.patchLayers.execute(ids.slice(0, 2), { placement: { settings: { width: 0.6 } } });

    expect(placement(ids[2]!)).toEqual({ ...INSET, centerX: 0.8 });
    expect(layer(pictureId)).toEqual(picture);
  });

  it('is one undo step for every layer, and a drag over one field of the same layers is one too', async () => {
    const { store, actions, ids, placement } = await threeBrolls();

    actions.patchLayers.execute(ids, { placement: { settings: { width: 0.5 } } });
    actions.patchLayers.execute(ids, { placement: { settings: { width: 0.55 } } });
    actions.patchLayers.execute(ids, { placement: { settings: { width: 0.6 } } });
    store.undo();

    expect(ids.map((id) => placement(id))).toEqual([
      { ...INSET, centerX: 0.2 },
      { ...INSET, centerX: 0.5 },
      { ...INSET, centerX: 0.8 },
    ]);
  });

  it('switches every layer to a layout from its fresh settings, keeping how each fills its box, and leaves one already in it alone', async () => {
    const { actions, ids, pictureId, placement } = await threeBrolls();
    actions.setLayerPlacement.execute(ids[0]!, { kind: 'full', fit: 'contain' });

    actions.patchLayers.execute([ids[0]!, ids[1]!, pictureId], { placement: { layout: 'split' } });

    expect(placement(ids[0]!)).toMatchObject({ kind: 'split', fit: 'contain', assetRatio: 0.5 });
    expect(placement(ids[1]!)).toMatchObject({ kind: 'split', fit: 'cover', assetRatio: 0.5 });
    expect(placement(pictureId).kind).toBe('split');
  });

  it('gives a setting only to the layers whose layout holds it, clamped to that layout\'s range', async () => {
    const { actions, ids, placement } = await threeBrolls();
    actions.setLayerPlacement.execute(ids[0]!, FULL);

    actions.patchLayers.execute(ids.slice(0, 2), { placement: { settings: { padding: 0.3, fit: 'contain' } } });

    expect(placement(ids[0]!)).toEqual({ kind: 'full', fit: 'contain' });
    expect(placement(ids[1]!)).toEqual({ ...INSET, centerX: 0.5, padding: 0.2, fit: 'contain' });
  });

  it('gives a stretch only to the b-rolls of a mixed selection, and the layout to all of it', async () => {
    const { actions, ids, pictureId, layer, placement } = await threeBrolls();
    const picture = layer(pictureId);

    actions.patchLayers.execute([ids[0]!, pictureId], { placement: { layout: 'full' }, timing: { loop: true, inSec: 1 } });

    expect(layer(ids[0]!)).toMatchObject({ loop: true, inSec: 1 });
    expect(layer(pictureId)).toMatchObject({ loop: picture.loop, inSec: picture.inSec });
    expect([placement(ids[0]!).kind, placement(pictureId).kind]).toEqual(['full', 'full']);
  });

  it('reads a stretch against each layer\'s own file: a start past a short file stops short of its end, an end past it is the file\'s end', async () => {
    const { actions, ids, layer } = await threeBrolls({ a: 8, b: 3 });

    actions.patchLayers.execute(ids.slice(0, 2), { timing: { inSec: 4 } });
    expect([layer(ids[0]!).inSec, layer(ids[1]!).inSec]).toEqual([4, 2.9]);

    actions.patchLayers.execute(ids.slice(0, 2), { timing: { outSec: 6 } });
    expect([layer(ids[0]!).outSec, layer(ids[1]!).outSec]).toEqual([6, null]);
  });

  it('moves an end the new start would pass to just after it', async () => {
    const { actions, ids, layer } = await threeBrolls();
    actions.patchLayers.execute([ids[0]!], { timing: { outSec: 2 } });

    actions.patchLayers.execute([ids[0]!], { timing: { inSec: 3 } });

    expect([layer(ids[0]!).inSec, layer(ids[0]!).outSec]).toEqual([3, 3.1]);
  });

  it('keeps what fills a box around a fitted file and where a filling one is cropped, each only while its fit reads it', async () => {
    const { actions, ids, placement } = await threeBrolls();

    actions.setLayerPlacement.execute(ids[0]!, { kind: 'full', fit: 'contain', backdrop: 'black', position: { x: 0, y: 0.5 } });
    expect(placement(ids[0]!)).toEqual({ kind: 'full', fit: 'contain', backdrop: 'black' });

    actions.setLayerPlacement.execute(ids[0]!, { kind: 'full', fit: 'cover', backdrop: 'black', position: { x: 0, y: 0.5 } });
    expect(placement(ids[0]!)).toEqual({ kind: 'full', fit: 'cover', position: { x: 0, y: 0.5 } });
  });

  it('keeps how a file fills its box across a switch of layout, and gives a group what fills it', async () => {
    const { actions, ids, placement } = await threeBrolls();
    actions.setLayerPlacement.execute(ids[0]!, { kind: 'full', fit: 'contain', backdrop: 'black' });

    actions.patchLayers.execute([ids[0]!], { placement: { layout: 'split' } });
    expect(placement(ids[0]!)).toMatchObject({ kind: 'split', fit: 'contain', backdrop: 'black' });

    actions.patchLayers.execute(ids.slice(0, 2), { placement: { settings: { fit: 'contain', backdrop: 'blur' } } });
    expect([placement(ids[0]!).backdrop, placement(ids[1]!).backdrop]).toEqual(['blur', 'blur']);
  });

  it('gives a layer a camera of its own, its sound on the layer\'s camera, taken with it', async () => {
    const { store, actions, ids } = await threeBrolls();
    const target = { kind: 'layer', layerId: ids[0]! } as const;

    actions.setCamera.pick(target, 'layer-fast-zoom-in-camera');
    expect(store.snapshot().shots.layerStyles.get(ids[0]!)?.animations?.[ElementAnimationScope.CAMERA]?.presetId).toBe('layer-fast-zoom-in-camera');
    expect(store.snapshot().audio.clips().map((clip) => clip.start.anchor)).toEqual([{ kind: 'layer-camera', layerId: ids[0] }]);
    expect(store.snapshot().shots.hasLayerCamera(ids[0]!)).toBe(true);

    actions.setCamera.pick(target, null);
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(store.snapshot().shots.hasLayerCamera(ids[0]!)).toBe(false);
  });

  it('keeps where a layer\'s file is cropped apart from where its camera looks', async () => {
    const { store, actions, ids } = await threeBrolls();
    const target = { kind: 'layer', layerId: ids[0]! } as const;
    const cropped = { kind: 'full', fit: 'cover', position: { x: 1, y: 0.5 } } as const;
    actions.setLayerPlacement.execute(ids[0]!, cropped);

    actions.setCamera.pick(target, 'layer-punch-in-camera');
    expect(store.snapshot().shots.placementOf(ids[0]!)).toEqual(cropped);

    const recropped = { ...cropped, position: { x: 0, y: 0.5 } };
    actions.setLayerPlacement.execute(ids[0]!, recropped);
    expect(store.snapshot().shots.placementOf(ids[0]!)).toEqual(recropped);
    expect(store.snapshot().shots.layerStyles.get(ids[0]!)?.animations?.[ElementAnimationScope.CAMERA]?.presetId).toBe('layer-punch-in-camera');
  });

  it('does not remember where a file was cropped for the next layer of its role', async () => {
    const { store, actions, ids } = await threeBrolls();

    actions.setLayerPlacement.execute(ids[0]!, { kind: 'full', fit: 'cover', position: { x: 1, y: 0.5 } });

    expect(store.snapshot().shots.placementForNewLayer('video')).toEqual({ kind: 'full', fit: 'cover' });
  });

  it('remembers for new layers the placement the first layer of each role was left with', async () => {
    const { store, actions, ids, pictureId } = await threeBrolls();

    actions.patchLayers.execute([ids[1]!, pictureId, ids[0]!], { placement: { settings: { cornerRadius: 0.2 } } });

    expect(store.snapshot().shots.placementForNewLayer('video')).toEqual({ ...INSET, centerX: 0.5, cornerRadius: 0.2 });
    expect(store.snapshot().shots.placementForNewLayer('picture')).toEqual({ ...PICTURE_LAYER_PLACEMENT, cornerRadius: 0.2 });
  });

  it('changes nothing, and adds no undo step, where every layer already holds the value', async () => {
    const { store, actions, ids } = await threeBrolls();
    const before = store.snapshot().shots;

    actions.patchLayers.execute(ids, { placement: { settings: { fit: 'cover' } } });

    expect(store.snapshot().shots).toBe(before);
  });

  it('removes several layers across the shots in one undo step', async () => {
    const { store, actions, ids, pictureId } = await threeBrolls();

    actions.removeLayers.execute([ids[0]!, ids[2]!, pictureId], 'popover');
    expect(store.snapshot().shots.list().slice(0, 3).map((shot) => shot.layers.length)).toEqual([0, 1, 0]);

    store.undo();
    expect(store.snapshot().shots.list().slice(0, 3).map((shot) => shot.layers.length)).toEqual([2, 1, 1]);
  });
});

/**
 * Motion given to several layers at once. Picking a preset reaches every
 * one; a field changed reaches only the layers whose preset holds it, so
 * each keeps the rest of what it was given.
 */
describe('moving several layers together', () => {
  async function threeLayers() {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video', third: 'video' }));
    actions.split.execute(7);
    actions.split.execute(3);
    const shots = store.snapshot().shots.list();
    await actions.showFile.execute(shots[0]!.id, 'clip', 'shot-picker');
    await actions.showFile.execute(shots[1]!.id, 'other', 'shot-picker');
    await actions.showFile.execute(shots[2]!.id, 'third', 'shot-picker');
    const ids = store.snapshot().shots.list().slice(0, 3).map((shot) => shot.layers[0]!.id);
    return { store, actions, ids };
  }

  it('gives every layer the preset picked at its own values, whatever each one\'s old preset was set to', async () => {
    const { store, actions, ids } = await threeLayers();
    actions.setLayerAnimation.pick([ids[0]!], ENTRANCE, 'layer-fade-entrance');
    actions.setLayerAnimation.setParam([ids[0]!], ENTRANCE, 'duration', 1);

    actions.setLayerAnimation.pick(ids, ENTRANCE, 'layer-slide-entrance');

    expect(ids.map((id) => animationOf(store, id, ENTRANCE))).toEqual([
      { presetId: 'layer-slide-entrance', params: {} },
      { presetId: 'layer-slide-entrance', params: {} },
      { presetId: 'layer-slide-entrance', params: {} },
    ]);
  });

  it('sets a field only where the layer\'s preset holds it, and leaves the other end alone', async () => {
    const { store, actions, ids } = await threeLayers();
    actions.setLayerAnimation.pick(ids.slice(0, 2), ENTRANCE, 'layer-wipe-entrance');
    actions.setLayerAnimation.pick([ids[2]!], ENTRANCE, 'layer-fade-entrance');
    actions.setLayerAnimation.pick([ids[2]!], EXIT, 'layer-pop-exit');

    actions.setLayerAnimation.setParam(ids, ENTRANCE, 'direction', '90deg');

    expect(ids.map((id) => animationOf(store, id, ENTRANCE)?.params['direction'])).toEqual(['90deg', '90deg', undefined]);
    expect(animationOf(store, ids[2]!, EXIT)?.presetId).toBe('layer-pop-exit');
  });

  it('is one undo step for every layer', async () => {
    const { store, actions, ids } = await threeLayers();

    actions.setLayerAnimation.pick(ids, EXIT, 'layer-blur-exit');
    store.undo();

    expect(ids.map((id) => animationOf(store, id, EXIT))).toEqual([null, null, null]);
  });

  it('takes the motion away from every layer with none', async () => {
    const { store, actions, ids } = await threeLayers();
    actions.setLayerAnimation.pick(ids, EXIT, 'layer-blur-exit');

    actions.setLayerAnimation.pick(ids, EXIT, null);

    expect(ids.map((id) => animationOf(store, id, EXIT))).toEqual([null, null, null]);
  });
});

/**
 * A layer's CSS typed by hand. The promise: it becomes the text of the
 * layer's style, and nothing the panels recorded is lost under it.
 */
describe('writing a layer\'s CSS by hand', () => {
  async function laidOutLayer() {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video' }));
    actions.split.execute(7);
    actions.addLayer.execute(store.snapshot().shots.list()[0]!.id, CLIP_LAYER);
    actions.setLayerPlacement.execute(CLIP_LAYER.id, INSET);
    return { store, actions, style: () => store.snapshot().shots.layerStyles.get(CLIP_LAYER.id)! };
  }

  it('becomes the layer\'s CSS, and the layout its fields hold stays recorded', async () => {
    const { store, actions, style } = await laidOutLayer();
    const css = `${style().css}\nrotate: 8deg;`;

    actions.setLayerCss.execute(CLIP_LAYER.id, css);

    expect(style().css).toBe(css);
    expect(store.snapshot().shots.placementOf(CLIP_LAYER.id)).toEqual(INSET);
  });

  it('writes a shot\'s own video too, making a proposed shot the user\'s own, and lets an emptied text style nothing', () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[1]!.id;
    const video = ShotVideoLayerId.of(shotId);

    actions.setLayerCss.execute(video, 'rotate: 2deg;');
    expect(store.snapshot().shots.layerStyles.get(video)?.css).toBe('rotate: 2deg;');
    expect(store.snapshot().shots.hasStyledVideo()).toBe(true);

    actions.setLayerCss.execute(video, '');
    expect(store.snapshot().shots.layerStyles.get(video)).toBeNull();
    expect(store.snapshot().shots.hasStyledVideo()).toBe(false);
  });

  it('gives a run of keystrokes back to undo as one step', async () => {
    const { store, actions, style } = await laidOutLayer();
    const before = style().css;

    for (const css of ['r', 'ro', 'rotate: 8deg;']) actions.setLayerCss.execute(CLIP_LAYER.id, `${before}\n${css}`);
    store.undo();

    expect(style().css).toBe(before);
  });

  it('writes nothing for a layer no shot holds', async () => {
    const { store, actions } = await laidOutLayer();
    const before = store.snapshot().shots;

    actions.setLayerCss.execute('gone', 'rotate: 8deg;');

    expect(store.snapshot().shots).toBe(before);
  });
});

describe('a shot\'s camera', () => {
  const CAMERA = ElementAnimationScope.CAMERA;
  const FAST_ZOOM_IN = 'layer-fast-zoom-in-camera';
  const ZOOM_IN = 'layer-zoom-in-camera';
  const cameraOf = (store: EditorStore, shotId: string) => {
    const style = store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId));
    const animation = style?.animations?.[CAMERA];
    return ShotCamera.of(style?.fields, animation, animation?.presetId ? animationCatalog.byId(animation.presetId) : null);
  };
  const soundsOn = (store: EditorStore, shotId: string) => store.snapshot().audio.clips().filter((clip) =>
    clip.start.anchor.kind === 'camera' && clip.start.anchor.shotId === shotId);
  const onShotStart = (store: EditorStore, shotId: string) => store.snapshot().audio.clips().filter((clip) =>
    clip.start.anchor.kind === 'shot' && clip.start.anchor.shotId === shotId && clip.start.anchor.edge === 'start');
  const effectOn = (anchor: AudioAnchor, id: string) => new AudioClipDefaults().clipFrom(id, {
    role: 'effect',
    source: { kind: 'builtin', soundId: 'pop' },
    start: { anchor, offsetSec: 0 },
  });
  const cssOf = (store: EditorStore, shotId: string) =>
    store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId))?.css ?? '';

  function splitEditor() {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    return { store, actions, shotId: store.snapshot().shots.list()[0]!.id };
  }

  it('makes the proposal the user\'s own and writes a camera preset into the shot video\'s CSS, with its sound', async () => {
    const store = editorWithSpeech();
    const shotId = new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[1]!.id;

    actionsFor(store).setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);

    const camera = cameraOf(store, shotId);
    expect(camera.presetId).toBe(FAST_ZOOM_IN);
    expect(camera.start.scale).toBe(1);
    expect(camera.end.scale).toBe(1.4);
    expect(camera.durationSec).toBe(0.35);
    expect(cssOf(store, shotId)).toContain('--layer-camera-animation');
    // A snap is fastest as it starts: the whoosh's loudest moment, 0.1 s in, lands on the shot's start.
    expect(soundsOn(store, shotId)).toEqual([expect.objectContaining({
      source: { kind: 'builtin', soundId: 'whoosh-fast' },
      start: { anchor: { kind: 'camera', shotId }, offsetSec: -0.1 },
      volume: 0.056,
    })]);
    expect(onShotStart(store, shotId)).toEqual([]);
  });

  it('keeps the earlier shot\'s camera on a join and gives the new half of a split none', async () => {
    const { store, actions, shotId } = splitEditor();
    const second = store.snapshot().shots.list()[1]!.id;
    actions.setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);
    actions.setCamera.pick({ kind: 'shot', shotId: second }, ZOOM_IN);

    actions.join.execute(second);
    expect(cameraOf(store, shotId).presetId).toBe(FAST_ZOOM_IN);
    expect(store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(second))).toBeNull();

    actions.split.execute(1);
    const opened = store.snapshot().shots.list().find((shot) => shot.startSec === 1)!;
    expect(store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(opened.id))).toBeNull();
  });

  it('gives nothing to the video of a shot the partition does not hold', async () => {
    const { store, actions } = splitEditor();
    const before = store.snapshot().shots;

    actions.setCamera.pick({ kind: 'shot', shotId: 'no-such-shot' }, FAST_ZOOM_IN);

    expect(store.snapshot().shots).toBe(before);
  });

  it('takes a preset back, its sound with it, in one undo step', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);
    store.undo();

    expect(cameraOf(store, shotId).isUntouched()).toBe(true);
    expect(soundsOn(store, shotId)).toEqual([]);
  });

  it('gives another preset its own values and the frame\'s crop back, and swaps the sound for its own', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    actions.setCamera.setDuration({ kind: 'shot', shotId }, 2);
    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'end', ShotVideoFraming.at(1.5, 0, 0));
    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-crash-zoom-camera');

    const camera = cameraOf(store, shotId);
    expect(camera.durationSec).toBe(0.15);
    expect(camera.end).toMatchObject({ scale: 1.9, x: null, y: null });
    expect(soundsOn(store, shotId).map((clip) => clip.source)).toEqual([{ kind: 'builtin', soundId: 'swish-heavy' }]);
  });

  it('keeps what was changed by hand when the preset the shot has is picked again', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    actions.setCamera.setDuration({ kind: 'shot', shotId }, 2);
    const before = store.snapshot();
    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);

    expect(store.snapshot()).toBe(before);
  });

  it('sets how close a box goes as the preset\'s value, and where it looks as the shot\'s own', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'end', ShotVideoFraming.at(1.6, 0.2, 0.8));

    expect(effectParams(store, shotId)).toMatchObject({ zoom: 1.6 });
    expect(cameraOf(store, shotId).end).toMatchObject({ scale: 1.6, x: 0.2, y: 0.8 });
  });

  it('zooms straight into the end framing: the whole frame takes its position where the frame crops nothing', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'end', ShotVideoFraming.at(1.3, 0, 1));

    expect(cameraOf(store, shotId).start).toMatchObject({ scale: 1, x: 0, y: 1 });
  });

  it('moves a pan\'s travel as its own values, and keeps it its own when the frame\'s crop is given back', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-pan-right-camera');
    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'start', ShotVideoFraming.at(1.3, 0.2, 0.4));
    expect(effectParams(store, shotId)).toMatchObject({ 'start-x': 0.2 });
    expect(cameraOf(store, shotId).start).toMatchObject({ x: 0.2, y: 0.4 });

    actions.setCamera.followFrame({ kind: 'shot', shotId }, 'x');
    expect(cameraOf(store, shotId).holdsOwnShare('x')).toBe(true);
    actions.setCamera.followFrame({ kind: 'shot', shotId }, 'y');
    expect(cameraOf(store, shotId).holdsOwnShare('y')).toBe(false);
  });

  it('places a shot with no camera along the axis a vertical frame crops it, and nothing closer', async () => {
    const { store, actions, shotId } = splitEditor();
    store.patch({ video: { ...store.snapshot().video, layout: { width: 1920, height: 1080 } }, outputFrame: OutputFrame.original().withFormat('9:16') });

    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'start', ShotVideoFraming.at(1.4, 0.3, 0.6));

    expect(store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId))?.fields).toEqual({ 'picture-x': 0.3 });
    expect(cameraOf(store, shotId).start).toMatchObject({ scale: 1, x: 0.3, y: null });
  });

  it('places nothing on a shot with no camera where the frame crops nothing of it', async () => {
    const { store, actions, shotId } = splitEditor();
    const before = store.snapshot();

    actions.setCamera.setFraming({ kind: 'shot', shotId }, 'start', ShotVideoFraming.at(1, 0.3, 0.6));

    expect(store.snapshot()).toBe(before);
  });

  it('places an eased move\'s sound so it is loudest half way through, and moves it with the duration', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    expect(soundsOn(store, shotId)[0]?.start.offsetSec).toBe(0.11);

    actions.setCamera.setDuration({ kind: 'shot', shotId }, 2);
    expect(soundsOn(store, shotId)[0]?.start.offsetSec).toBe(0.61);
  });

  it('leaves the sounds on the shot\'s start alone', async () => {
    const { store, actions, shotId } = splitEditor();
    store.patch({ audio: store.snapshot().audio.withClipAdded(effectOn({ kind: 'shot', shotId, edge: 'start' }, 'mine')) });

    actions.setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);
    actions.setCamera.pick({ kind: 'shot', shotId }, null);

    expect(onShotStart(store, shotId).map((clip) => clip.id)).toEqual(['mine']);
  });

  it('keeps a sound added to the camera when another preset is picked, and takes it with the camera', async () => {
    const { store, actions, shotId } = splitEditor();
    actions.setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);
    store.patch({ audio: store.snapshot().audio.withClipAdded(effectOn({ kind: 'camera', shotId }, 'mine')) });

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);
    expect(soundsOn(store, shotId).map((clip) => clip.source)).toEqual([
      { kind: 'builtin', soundId: 'pop' },
      { kind: 'builtin', soundId: 'whoosh-deep' },
    ]);

    actions.setCamera.pick({ kind: 'shot', shotId }, null);
    expect(soundsOn(store, shotId)).toEqual([]);
  });

  it('leaves a camera its own CSS took over as it is, its sound included', async () => {
    const { store, actions, shotId } = splitEditor();
    actions.setCamera.pick({ kind: 'shot', shotId }, FAST_ZOOM_IN);
    const { shots } = store.snapshot();
    store.patch({ shots: shots.withLayerStyles(shots.layerStyles.withCss(ShotVideoLayerId.of(shotId), 'layer', '--layer-camera-animation: none;')) });
    const before = store.snapshot();

    actions.setCamera.pick({ kind: 'shot', shotId }, ZOOM_IN);

    expect(store.snapshot().shots).toBe(before.shots);
    expect(store.snapshot().audio).toBe(before.audio);
  });

  it('places a bounce\'s point as its own values', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-bounce-camera');
    actions.setCamera.setEffectAnchor({ kind: 'shot', shotId }, { x: 0.2, y: 0.7 });

    expect(cameraOf(store, shotId).anchor).toEqual({ x: 0.2, y: 0.7 });
  });

  it('takes the whole camera away, sound included', async () => {
    const { store, actions, shotId } = splitEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-bounce-camera');
    actions.setCamera.pick({ kind: 'shot', shotId }, null);

    expect(cameraOf(store, shotId).isUntouched()).toBe(true);
    expect(cssOf(store, shotId)).not.toContain('--layer-camera-animation');
    expect(soundsOn(store, shotId)).toEqual([]);
  });

  it('changes nothing for a shot the partition does not hold', async () => {
    const { store, actions } = splitEditor();
    const before = store.snapshot().shots;

    actions.setCamera.pick({ kind: 'shot', shotId: 'no-such-shot' }, ZOOM_IN);

    expect(store.snapshot().shots).toBe(before);
  });

  function effectParams(store: EditorStore, shotId: string) {
    return store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId))?.animations?.[CAMERA]?.params;
  }
});

/**
 * Each choice on shots is reported after it changed something, by kinds
 * and stable ids: never a file's name or id, never a graphic's code.
 */
describe('a shot that follows a person', () => {
  const FOLLOW: ShotFollow = {
    pictureAspectRatio: 16 / 9,
    heads: [{ sourceSec: 7, x: 0.3, y: 0.3 }, { sourceSec: 8, x: 0.4, y: 0.3 }, { sourceSec: 9, x: 0.5, y: 0.3 }],
    picked: {
      sourceSec: 7,
      people: [
        { box: { minX: 0.25, minY: 0.2, maxX: 0.35, maxY: 0.9 }, head: { x: 0.3, y: 0.3 } },
        { box: { minX: 0.6, minY: 0.2, maxX: 0.7, maxY: 0.9 }, head: { x: 0.65, y: 0.3 } },
      ],
      chosen: 0,
    },
  };
  const shotAt = (store: EditorStore, sec: number) => store.snapshot().shots.at(sec)!;
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );

  /** An editor whose shot opening at 7 s follows someone, and the middle of that shot, where it can be split. */
  function followingEditor() {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const shots = store.snapshot().shots.list();
    const own = shots.find((shot) => shot.startSec === 7)!;
    const next = shots[shots.indexOf(own) + 1]?.startSec ?? 24;
    actions.setFollow.execute(own.id, FOLLOW);
    return { store, actions, shotId: own.id, middleSec: (7 + next) / 2 };
  }

  const cameraOn = (store: EditorStore, shotId: string) => {
    const style = store.snapshot().shots.layerStyles.get(ShotVideoLayerId.of(shotId));
    const animation = style?.animations?.[ElementAnimationScope.CAMERA];
    return ShotCamera.of(style?.fields, animation, animation?.presetId ? animationCatalog.byId(animation.presetId) : null);
  };
  const cameraSoundsOn = (store: EditorStore, shotId: string) => store.snapshot().audio.clips().filter((clip) =>
    clip.start.anchor.kind === 'camera' && clip.start.anchor.shotId === shotId);
  const followOf = (store: EditorStore, shotId: string) => store.snapshot().shots.list().find((shot) => shot.id === shotId)?.follow;

  it('stops following once a camera, or none, is picked, as one step undo takes back', () => {
    const { store, actions, shotId } = followingEditor();

    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-zoom-in-camera');
    expect(followOf(store, shotId)).toBeUndefined();
    store.undo();
    expect(followOf(store, shotId)).toEqual(FOLLOW);

    actions.setCamera.pick({ kind: 'shot', shotId }, null);
    expect(followOf(store, shotId)).toBeUndefined();
  });

  it('holds a followed shot as close as asked with no move, its camera\'s move and sounds gone, still following', () => {
    const { store, actions, shotId } = followingEditor();
    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-zoom-in-camera');
    actions.setFollow.execute(shotId, FOLLOW);
    expect(cameraSoundsOn(store, shotId)).not.toEqual([]);

    actions.setCamera.holdCloseness({ kind: 'shot', shotId }, 1.4);

    expect(cameraOn(store, shotId)).toMatchObject({ presetId: 'layer-punch-in-camera', start: { scale: 1.4 }, end: { scale: 1.4 } });
    expect(cameraSoundsOn(store, shotId)).toEqual([]);
    expect(followOf(store, shotId)).toEqual(FOLLOW);

    actions.setCamera.holdCloseness({ kind: 'shot', shotId }, 1);
    expect(cameraOn(store, shotId).presetId).toBeNull();
    expect(followOf(store, shotId)).toEqual(FOLLOW);
  });

  it('keeps of a camera only how close it comes, once the shot starts to follow someone', () => {
    const { store, actions, shotId } = followingEditor();
    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-zoom-in-camera');
    const closest = Math.max(cameraOn(store, shotId).start.scale, cameraOn(store, shotId).end.scale);

    actions.setCamera.holdClosest({ kind: 'shot', shotId });

    expect(closest).toBeGreaterThan(1);
    expect(cameraOn(store, shotId)).toMatchObject({ presetId: 'layer-punch-in-camera', start: { scale: closest }, end: { scale: closest } });
  });

  it('keeps who it follows, as one step undo takes back', () => {
    const { store, shotId } = followingEditor();

    expect(shotAt(store, 7).follow).toEqual(FOLLOW);
    expect(store.snapshot().shots.hasStyledVideo()).toBe(true);
    store.undo();
    expect(store.snapshot().shots.list().find((shot) => shot.id === shotId)?.follow).toBeUndefined();
  });

  it('makes a proposed shot the user\'s own to follow someone on it', () => {
    const store = editorWithSpeech();
    const proposed = materializer.materializeFrom(store.snapshot()).at(9)!;

    actionsFor(store).setFollow.execute(proposed.id, FOLLOW);

    expect(store.snapshot().shots.isEmpty()).toBe(false);
    expect(shotAt(store, 9).id).toBe(proposed.id);
    expect(shotAt(store, 9).follow).toEqual(FOLLOW);
  });

  it('goes on following over both halves of a shot split in two', () => {
    const { store, actions, shotId, middleSec } = followingEditor();

    actions.split.execute(middleSec);

    const split = store.snapshot().shots;
    expect(split.videoRunOf(shotId).map((shot) => shot.startSec)).toEqual([7, middleSec]);
    expect(split.videoShotOf(shotAt(store, middleSec).id)?.id).toBe(shotId);
  });

  it('keeps the follow of the shot joined into', () => {
    const { store, actions, shotId, middleSec } = followingEditor();
    actions.split.execute(middleSec);

    actions.join.execute(shotAt(store, middleSec).id);

    expect(shotAt(store, middleSec).id).toBe(shotId);
    expect(shotAt(store, middleSec).follow).toEqual(FOLLOW);
  });

  it('ends the video run of an earlier shot where a later one starts following someone', () => {
    const { store, actions, shotId, middleSec } = followingEditor();
    actions.split.execute(middleSec);
    const later = shotAt(store, middleSec).id;

    actions.setFollow.execute(later, { ...FOLLOW, heads: [{ sourceSec: middleSec, x: 0.7, y: 0.3 }] });

    expect(store.snapshot().shots.videoRunOf(shotId).map((shot) => shot.id)).toEqual([shotId]);
    expect(store.snapshot().shots.videoShotOf(later)?.id).toBe(later);
  });

  it('stops following', () => {
    const { store, actions, shotId } = followingEditor();

    actions.setFollow.execute(shotId, null);

    expect(shotAt(store, 7).follow).toBeUndefined();
    expect(store.snapshot().shots.hasStyledVideo()).toBe(false);
  });

  it('is kept as it is through a save and a reload, what cannot be read dropped', () => {
    const { store, shotId } = followingEditor();
    const stored = JSON.parse(JSON.stringify(store.snapshot().shots.toSnapshot())) as ShotsSnapshot;
    const damaged = {
      ...stored,
      shots: stored.shots.map((shot) => (shot.id === shotId
        ? { ...shot, follow: { ...shot.follow!, heads: [...shot.follow!.heads, { sourceSec: 10, x: 1.5, y: 0.3 }, { sourceSec: 'later', x: 0.5, y: 0.5 }] } }
        : shot)),
    } as ShotsSnapshot;

    expect(ShotPartition.fromSnapshot(stored).list().find((shot) => shot.id === shotId)?.follow).toEqual(FOLLOW);
    expect(ShotPartition.fromSnapshot(damaged).list().find((shot) => shot.id === shotId)?.follow).toEqual(FOLLOW);
  });

  it('keeps who it follows without the frame it was picked on where that frame cannot be read', () => {
    const { store, shotId } = followingEditor();
    const stored = JSON.parse(JSON.stringify(store.snapshot().shots.toSnapshot())) as ShotsSnapshot;
    const pickedNobody = {
      ...stored,
      shots: stored.shots.map((shot) => (shot.id === shotId ? { ...shot, follow: { ...shot.follow!, picked: { ...shot.follow!.picked!, chosen: 2 } } } : shot)),
    } as ShotsSnapshot;

    const { picked: _dropped, ...withoutFrame } = FOLLOW;
    expect(ShotPartition.fromSnapshot(pickedNobody).list().find((shot) => shot.id === shotId)?.follow).toEqual(withoutFrame);
  });

  it('keeps where the camera looks until the person is found through a reload, and drops it where it cannot be read', () => {
    const { store, shotId } = followingEditor();
    const stored = JSON.parse(JSON.stringify(store.snapshot().shots.toSnapshot())) as ShotsSnapshot;
    const withFollow = (follow: object) => ({
      ...stored,
      shots: stored.shots.map((shot) => (shot.id === shotId ? { ...shot, follow: { ...shot.follow!, ...follow } } : shot)),
    }) as ShotsSnapshot;
    const followOf = (snapshot: ShotsSnapshot) => ShotPartition.fromSnapshot(snapshot).list().find((shot) => shot.id === shotId)?.follow;

    expect(followOf(withFollow({ untilFound: { x: 0.4, y: 0.5 } }))).toEqual({ ...FOLLOW, untilFound: { x: 0.4, y: 0.5 } });
    expect(followOf(withFollow({ untilFound: { x: 1.4, y: 0.5 } }))).toEqual(FOLLOW);
  });
});

describe('reporting what is done with shots', () => {
  it('reports how the partition was cut, the first edit as the one that made it real, and a moved boundary once', () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);

    actions.split.execute(7);
    actions.split.execute(3);
    const second = store.snapshot().shots.list()[1]!;
    actions.moveStart.execute(second.id, second.startSec + 0.1);
    actions.moveStart.execute(second.id, second.startSec + 0.2);
    actions.join.execute(second.id);
    actions.repropose.execute(5);

    expect(actions.telemetry.propertiesOf('shot_partition_edited')).toEqual([
      { kind: 'split', made_real: true },
      { kind: 'split', made_real: false },
      { kind: 'move-boundary', made_real: false },
      { kind: 'join', made_real: false },
      { kind: 'repropose', made_real: false, max_shot_sec: 5, discarded_edits: true },
    ]);
  });

  it('reports a file shown on a shot by its role and type, and says when it took the place of a b-roll', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ clip: 'video', other: 'video', logo: 'image' }));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;

    await actions.showFile.execute(shotId, 'clip', 'bin-drop');
    await actions.showFile.execute(shotId, 'other', 'shot-picker');
    await actions.showFile.execute(shotId, 'logo', 'shot-upload');

    expect(actions.telemetry.propertiesOf('shot_file_placed')).toEqual([
      { role: 'video', media_type: 'video', effect: 'added', origin: 'bin-drop' },
      { role: 'video', media_type: 'video', effect: 'replaced', origin: 'shot-picker' },
      { role: 'picture', media_type: 'image', effect: 'added', origin: 'shot-upload' },
    ]);
    expect(JSON.stringify(actions.telemetry.events)).not.toMatch(/clip|other|logo/);
  });

  it('reports a GIF this browser cannot play by the names of its failure, and the layers taken off by what they showed', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store, mediaHolding({ wave: 'gif', spin: 'gif' }), new Set(['spin']));
    actions.split.execute(7);
    const shotId = store.snapshot().shots.list()[0]!.id;
    await actions.showFile.execute(shotId, 'wave', 'shot-picker');
    await expect(actions.showFile.execute(shotId, 'spin', 'shot-picker')).rejects.toMatchObject({ name: 'ShotFileShowFailedError' });
    const layerId = store.snapshot().shots.list()[0]!.layers[0]!.id;

    actions.removeLayers.execute([layerId], 'selection');
    actions.removeLayers.execute([layerId], 'selection');

    expect(actions.telemetry.propertiesOf('shot_file_place_failed')).toEqual([
      { media_type: 'gif', origin: 'shot-picker', error_name: 'ShotFileShowFailedError', error_cause_name: expect.any(String), http_status: null },
    ]);
    expect(actions.telemetry.propertiesOf('shot_layers_removed')).toEqual([{ layer_count: 1, roles: ['gif'], origin: 'selection' }]);
  });

  it('reports a layout picked, and nothing for a box only moved', () => {
    const store = withClipLayer();
    const actions = actionsFor(store, mediaHolding({ clip: 'video' }));

    actions.setLayerPlacement.execute('layer', INSET);
    actions.setLayerPlacement.execute('layer', { ...INSET, centerX: 0.2 });
    actions.patchLayers.execute(['layer'], { placement: { settings: { fit: 'contain' } } });

    expect(actions.telemetry.propertiesOf('shot_layer_layout_set')).toEqual([
      { field: 'layout', value: 'inset', layer_count: 1 },
      { field: 'fit', value: 'contain', layer_count: 1 },
    ]);
  });

  it('reports a motion and a camera picked, and nothing for the one already picked', () => {
    const store = withClipLayer();
    const actions = actionsFor(store, mediaHolding({ clip: 'video' }));
    const shotId = store.snapshot().shots.list()[0]!.id;

    actions.setLayerAnimation.pick(['layer'], ENTRANCE, 'layer-fade-entrance');
    actions.setLayerAnimation.pick(['layer'], ENTRANCE, 'layer-fade-entrance');
    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-fast-zoom-in-camera');
    actions.setCamera.pick({ kind: 'shot', shotId }, 'layer-fast-zoom-in-camera');
    actions.setCamera.pick({ kind: 'shot', shotId }, null);

    expect(actions.telemetry.propertiesOf('shot_layer_motion_set')).toEqual([{ scope: 'entrance', preset: 'layer-fade-entrance', layer_count: 1 }]);
    expect(actions.telemetry.propertiesOf('shot_camera_set')).toEqual([
      { target: 'shot', preset: 'layer-fast-zoom-in-camera', previous_preset: 'none' },
      { target: 'shot', preset: 'none', previous_preset: 'layer-fast-zoom-in-camera' },
    ]);
  });

  it('reports a graphic by the preset it came from, its code edits once per part and never their text', async () => {
    const store = editorWithSpeech();
    const actions = actionsFor(store);
    actions.split.execute(7);
    const [first, second] = store.snapshot().shots.list();
    const other = new BuiltinGraphicPresetCatalog().list().find((preset) => preset.id !== LOWER_THIRD_GRAPHIC_PRESET.id)!;

    const layerId = actions.addGraphic.execute(second!.id, LOWER_THIRD_GRAPHIC_PRESET)!;
    actions.addGraphic.execute(first!.id, LOWER_THIRD_GRAPHIC_PRESET);
    actions.setGraphic.applyPreset(layerId, LOWER_THIRD_GRAPHIC_PRESET);
    actions.setGraphic.applyPreset(layerId, other);
    actions.setGraphic.setDocument(layerId, 'html', '<p>my secret words</p>');
    actions.setGraphic.setDocument(layerId, 'html', '<p>my secret words, again</p>');
    await actions.saveGraphicPreset.execute(layerId, 'My own name');

    expect(actions.telemetry.propertiesOf('shot_graphic_added')).toEqual([
      { preset: LOWER_THIRD_GRAPHIC_PRESET.id, first_shot: false },
      { preset: LOWER_THIRD_GRAPHIC_PRESET.id, first_shot: true },
    ]);
    expect(actions.telemetry.propertiesOf('graphic_preset_applied')).toEqual([
      { preset: other.id, category: other.category ?? 'none', previous_preset: LOWER_THIRD_GRAPHIC_PRESET.id },
    ]);
    expect(actions.telemetry.propertiesOf('graphic_code_edited')).toEqual([{ part: 'html' }]);
    expect(actions.telemetry.propertiesOf('graphic_preset_saved')).toEqual([{ mode: 'create', from_preset: other.id }]);
    expect(JSON.stringify(actions.telemetry.events)).not.toMatch(/secret|My own name/);
  });

  function withClipLayer(): EditorStore {
    const store = editorWithSpeech();
    actionsFor(store).addLayer.execute(store.snapshot().shots.list()[0]?.id ?? proposedShotId(store), CLIP_LAYER);
    return store;
  }

  function proposedShotId(store: EditorStore): string {
    return new ShotPartitionMaterializer(
      new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
      new OriginalCaptionTrackReader(),
    ).materializeFrom(store.snapshot()).list()[0]!.id;
  }
});
