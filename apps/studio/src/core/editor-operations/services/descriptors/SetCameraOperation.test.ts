import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { RemoveAudioClipsAction } from '@core/audio-mix/actions/RemoveAudioClipsAction';
import { AudioClipDefaults } from '@core/audio-mix/domain/AudioClipDefaults';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { SetCameraOperation } from '@core/editor-operations/services/descriptors/SetCameraOperation';
import { SetShotCameraAction } from '@core/shots/actions/SetShotCameraAction';
import { SetShotVideoThroughAction } from '@core/shots/actions/SetShotVideoThroughAction';
import { SetShotLayerAnimationAction } from '@core/shots/actions/SetShotLayerAnimationAction';
import { ShotCamera } from '@core/shots/domain/ShotCamera';
import { ShotAimPoint } from '@core/shots/services/ShotAimPoint';
import { ShotLayerPanPace } from '@core/shots/services/ShotLayerPanPace';
import { ShotPictureArea } from '@core/shots/services/ShotPictureArea';
import { ShotCameraSounds } from '@core/shots/domain/ShotCameraSounds';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { TestAudioMixTelemetry } from '@core/audio-mix/testing/TestAudioMixTelemetry';

/**
 * A camera asked for by a program: the move, its zoom and its aim
 * written on the end of the move that is close, its sound on the camera
 * unless left out, and nothing at all for an input the move cannot take.
 */

const CAMERA = ElementAnimationScope.CAMERA;
const presets = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
const animationWriter = new ElementAnimationCssWriter(new ElementAnimationCssBuilder(
  presets,
  new ElementTimingVariableResolver(),
  new ElementControlCssWriter(new CssFragmentParser(new CssMinifier())),
));
const layouts = new TestShotLayerLayouts();
const sounds = new ShotCameraSounds();

function editorWithSpeech(shots: ShotPartition = ShotPartition.empty()): EditorStore {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ id: `w${index}`, text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: new Document({ sections: [new Section({ kind: 'main', segments })] }),
    video: { ...store.snapshot().video, duration: 24 },
    shots,
  });
  return store;
}

function setUp(shots?: ShotPartition) {
  const store = editorWithSpeech(shots);
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const parser = new EditorRefParser();
  const resolver = new ShotRefResolver(store, materializer, parser);
  const media = new MediaAssetStore();
  const operation = new SetCameraOperation(
    store,
    resolver,
    parser,
    presets,
    animationWriter,
    sounds,
    new SetShotCameraAction(
      store, materializer, layouts.catalog, layouts.controls, presets, animationWriter, sounds, new AudioClipDefaults(),
      media, new ShotLayerAssetReader(), new ShotLayerBoxShape(), new RecordingShotTelemetry().edits,
    ),
    new SetShotLayerAnimationAction(store, materializer, presets, animationWriter, new RecordingShotTelemetry().edits),
    new RemoveAudioClipsAction(store, new TestAudioMixTelemetry().reporter),
    new ShotPictureArea(presets),
    new ShotAimPoint(),
    new SetShotVideoThroughAction(store),
    new ShotLayerPanPace(media, new ShotLayerAssetReader(), new ShotLayerBoxShape()),
  );
  return { store, operation, resolver, media, shot: resolver.shots()[1]! };
}

function cameraOf(store: EditorStore, styleId: string): ShotCamera {
  const style = store.snapshot().shots.layerStyles.get(styleId);
  const animation = style?.animations?.[CAMERA];
  return ShotCamera.of(style?.fields, animation, animation?.presetId ? presets.byId(animation.presetId) : null);
}

function paramsOf(store: EditorStore, styleId: string) {
  return store.snapshot().shots.layerStyles.animationOf(styleId, CAMERA)?.params;
}

describe('set_camera', () => {
  it('punches in on a proposed shot where it is aimed, holding that framing for the whole shot', async () => {
    const { store, operation, shot } = setUp();

    const result = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1.5, x: 0.5, y: 0.5 });

    const camera = cameraOf(store, ShotVideoLayerId.of(shot.shot.id));
    expect(result.ok).toBe(true);
    expect(store.snapshot().shots.isEmpty()).toBe(false);
    expect(camera.start).toMatchObject({ scale: 1.5, x: 0.5, y: 0.5 });
    expect(camera.moves()).toBe(false);
    expect(result.output).toMatchObject({
      target: shot.ref,
      camera: { preset: 'layer-punch-in-camera', scale: 1.5, x: 0.5, y: 0.5 },
      sounds: [],
    });
  });

  it('zooms straight into the point aimed at, over the length asked, with the move\'s own sound on the camera', async () => {
    const { store, operation, shot } = setUp();

    const result = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', scale: 1.6, x: 0.5, y: 0.5, durationSec: 2 });

    const camera = cameraOf(store, ShotVideoLayerId.of(shot.shot.id));
    expect(camera.end).toMatchObject({ scale: 1.6, x: 0.5, y: 0.5 });
    expect(camera.start).toMatchObject({ scale: 1, x: 0.5, y: 0.5 });
    expect(camera.durationSec).toBe(2);
    const onCamera = sounds.clipsOn(store.snapshot().audio, { kind: 'shot', shotId: shot.shot.id });
    expect(onCamera.map((clip) => clip.source)).toEqual([{ kind: 'builtin', soundId: 'whoosh-deep' }]);
    expect(result.output).toMatchObject({ sounds: [`sound:${onCamera[0]!.id}`] });
  });

  it('leaves the move\'s own sound out when asked', async () => {
    const { store, operation, shot } = setUp();

    await operation.run({ target: shot.ref, preset: 'layer-fast-zoom-in-camera', sound: false });

    expect(cameraOf(store, ShotVideoLayerId.of(shot.shot.id)).presetId).toBe('layer-fast-zoom-in-camera');
    expect(store.snapshot().audio.clips()).toEqual([]);
  });

  it('travels a pan between the points asked and bounces in on the point asked', async () => {
    const { store, operation, shot } = setUp();
    const styleId = ShotVideoLayerId.of(shot.shot.id);

    await operation.run({ target: shot.ref, preset: 'layer-pan-right-camera', fromX: 0.2, toX: 0.7, y: 0.5 });
    expect(paramsOf(store, styleId)).toMatchObject({ 'start-x': 0.2, 'end-x': 0.7 });
    expect(cameraOf(store, styleId).start.y).toBe(0.5);

    await operation.run({ target: shot.ref, preset: 'layer-bounce-camera', x: 0.25, y: 0.7, intensity: 0.6 });
    expect(cameraOf(store, styleId).anchor).toEqual({ x: 0.25, y: 0.7 });
    expect(paramsOf(store, styleId)).toMatchObject({ intensity: 0.6 });
  });

  it('changes the settings of the move there is when no preset is named, and takes the camera off with its sounds', async () => {
    const { store, operation, shot } = setUp();
    const styleId = ShotVideoLayerId.of(shot.shot.id);
    await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera' });

    await operation.run({ target: shot.ref, scale: 2 });
    expect(cameraOf(store, styleId)).toMatchObject({ presetId: 'layer-zoom-in-camera', end: { scale: 2 } });

    const result = await operation.run({ target: shot.ref, preset: null });
    expect(cameraOf(store, styleId).isUntouched()).toBe(true);
    expect(store.snapshot().audio.clips()).toEqual([]);
    expect(result.output).toMatchObject({ target: shot.ref, camera: null, sounds: [] });
  });

  it('runs a shot\'s camera through a later shot, and back to its own shot alone', async () => {
    const { store, operation, resolver, shot } = setUp();
    const later = resolver.shots()[3]!;
    const drawnOver = () => store.snapshot().shots.videoRunOf(shot.shot.id).map((each) => each.id);

    const longer = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', through: later.ref });

    expect(longer.output).toMatchObject({ through: later.ref, shots: 3 });
    expect(drawnOver()).toEqual([1, 2, 3].map((index) => resolver.shots()[index]!.shot.id));

    const back = await operation.run({ target: shot.ref, through: shot.ref });

    expect(back.output).toMatchObject({ through: shot.ref, shots: 1 });
    expect(drawnOver()).toEqual([shot.shot.id]);
  });

  it('stops a camera before a shot that has one of its own, and says where it stopped', async () => {
    const { operation, resolver, shot } = setUp();
    const [, , next, later] = resolver.shots();
    await operation.run({ target: later!.ref, preset: 'layer-punch-in-camera' });

    const result = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', through: later!.ref });

    expect(result.output).toMatchObject({ through: next!.ref, shots: 2 });
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', ref: next!.ref })]);
  });

  it('gives a punch-in to every shot through a later one as its own, even ones already framed', async () => {
    const { store, operation, resolver, shot } = setUp();
    const [, , next, later] = resolver.shots();
    await operation.run({ target: next!.ref, preset: 'layer-punch-in-camera', scale: 1.5 });

    const result = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1.2, through: later!.ref });

    expect(result.output).toMatchObject({ through: later!.ref, shots: 3 });
    expect(result.problems).toEqual([]);
    for (const each of [shot, next!, later!]) {
      expect(store.snapshot().shots.videoRunOf(each.shot.id).map((drawn) => drawn.id)).toEqual([each.shot.id]);
      expect(cameraOf(store, `shot-video-${each.shot.id}`)).toMatchObject({ presetId: 'layer-punch-in-camera', start: { scale: 1.2 } });
    }
  });

  it('stops a punch-in before a shot with a camera move of its own, and says where it stopped', async () => {
    const { operation, resolver, shot } = setUp();
    const [, , next, later] = resolver.shots();
    await operation.run({ target: later!.ref, preset: 'layer-zoom-in-camera' });

    const result = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', through: later!.ref });

    expect(result.output).toMatchObject({ through: next!.ref, shots: 2 });
    expect(result.problems).toEqual([expect.objectContaining({ severity: 'warning', ref: next!.ref })]);
  });

  it('refuses a shot before the camera\'s own, changing nothing', async () => {
    const { store, operation, resolver, shot } = setUp();
    const before = store.snapshot().shots;

    const result = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', through: resolver.shots()[0]!.ref });

    expect(result.ok).toBe(false);
    expect(store.snapshot().shots).toBe(before);
  });

  it('gives a b-roll layer a camera of its own', async () => {
    const { store, operation } = setUp(ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] }],
    }));

    const result = await operation.run({ target: 'layer:broll', preset: 'layer-slow-push-in-camera' });

    expect(result.ok).toBe(true);
    expect(cameraOf(store, 'broll').presetId).toBe('layer-slow-push-in-camera');
  });

  describe('a pan picked on a picture much wider than the frame it fills', () => {
    const pictureShots = () => ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'picture', mediaId: 'wide', inSec: 0, outSec: null, loop: false }] }, { id: 'b', startSec: 4, layers: [] }],
    });
    const wideOnVerticalFrame = () => {
      const context = setUp(pictureShots());
      context.media.put({ id: 'wide', type: 'image', owner: { kind: 'library' }, fileName: 'wide.jpg', mimeType: 'image/jpeg', sizeBytes: 1, widthPx: 1500, heightPx: 1000, durationSec: null });
      context.store.patch({ video: { ...context.store.snapshot().video, layout: { width: 1080, height: 1920 } } });
      return context;
    };

    it('drifts slowly about its middle for as long as the layer shows, in the move\'s own direction', async () => {
      const { store, operation } = wideOnVerticalFrame();

      const right = await operation.run({ target: 'layer:picture', preset: 'layer-pan-right-camera' });
      const rightTravel = paramsOf(store, 'picture');
      const left = await operation.run({ target: 'layer:picture', preset: 'layer-pan-left-camera' });

      // Held at 1.3, a 3:2 picture filling a 9:16 frame is 2.47 frames wider than it: 0.06 of a frame a second for 4 s is a tenth of that.
      expect(rightTravel).toMatchObject({ 'start-x': 0.45, 'end-x': 0.55 });
      expect(right.output).toMatchObject({ travels: '25% of the frame\'s width in 4.0 s' });
      expect((left.output as { camera: object }).camera).toMatchObject({ fromX: 0.55, toX: 0.45 });
    });

    it('travels as far as asked where its travel is given, and says how far that is', async () => {
      const { operation } = wideOnVerticalFrame();

      const result = await operation.run({ target: 'layer:picture', preset: 'layer-pan-right-camera', fromX: 0, toX: 1 });

      expect((result.output as { camera: object }).camera).toMatchObject({ fromX: 0, toX: 1 });
      expect(result.output).toMatchObject({ travels: '247% of the frame\'s width in 4.0 s' });
    });
  });

  describe('refuses, changing nothing', () => {
    const graphicShots = ShotPartition.fromSnapshot({
      maxShotSec: 4,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'graphic', graphic: new BuiltinGraphicPresetCatalog().starter().graphic }] }],
    });

    it.each([
      ['a move that does not exist', { preset: 'layer-dolly-camera' }, /not a camera move\. Moves: layer-punch-in-camera/],
      ['a zoom on a move that has none', { preset: 'layer-shake-camera', scale: 1.4 }, /no zoom of its own.*set intensity/],
      ['a length on a move that lasts the whole shot', { preset: 'layer-punch-in-camera', durationSec: 1 }, /lasts the whole shot/],
      ['x on a pan', { preset: 'layer-pan-left-camera', x: 0.4 }, /fromX and toX/],
      ['a setting given with the camera taken off', { preset: null, scale: 1.2 }, /preset null takes the camera off: scale/],
      ['settings on a shot with no camera yet', { scale: 1.2 }, /no camera move yet/],
    ])('%s', async (_, request, message) => {
      const { store, operation, shot } = setUp();
      const before = store.snapshot();

      const result = await operation.run({ target: shot.ref, ...request });

      expect(result.ok).toBe(false);
      expect(result.problems[0]?.message).toMatch(message);
      expect(store.snapshot()).toBe(before);
    });

    it('a graphic, which has no camera, and a shot that is gone', async () => {
      const { store, operation } = setUp(graphicShots);
      const before = store.snapshot();

      const onGraphic = await operation.run({ target: 'layer:graphic', preset: 'layer-punch-in-camera' });
      const onGone = await operation.run({ target: 'shot:gone', preset: 'layer-punch-in-camera' });

      expect(onGraphic.problems[0]?.message).toMatch(/is a graphic/);
      expect(onGone.problems[0]?.message).toMatch(/not a shot of this project/);
      expect(store.snapshot()).toBe(before);
    });

    it('a camera the video\'s own CSS took over', async () => {
      const { store, operation, shot } = setUp();
      await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera' });
      const { shots } = store.snapshot();
      store.patch({ shots: shots.withLayerStyles(shots.layerStyles.withCss(ShotVideoLayerId.of(shot.shot.id), 'layer', '--layer-camera-animation: none;')) });
      const before = store.snapshot();

      const result = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera' });

      expect(result.problems[0]?.message).toMatch(/written by hand in its CSS/);
      expect(store.snapshot()).toBe(before);
    });
  });

  it('says what part of the picture a shot shows', async () => {
    const { operation, shot } = setUp();

    const result = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1.25, x: 0.5, y: 0.5, sound: false });

    expect((result.output as { shows: string }).shows).toBe('10% to 90% of the picture\'s width, 10% to 90% of its height');
  });

  it('keeps a framed shot looking at its point when a zoom is picked, at both ends of the zoom', async () => {
    const { store, operation, shot } = setUp();
    store.patch({ video: { ...store.snapshot().video, layout: { width: 1920, height: 1080 } }, outputFrame: OutputFrame.original().withFormat('9:16') });
    await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1, x: 0.8, sound: false });

    const zoomed = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', scale: 1.4, sound: false });

    const camera = cameraOf(store, ShotVideoLayerId.of(shot.shot.id));
    // A 9:16 frame of a 16:9 picture shows 9/16 × 9/16 of its width at the frame's closeness.
    const wholeSide = (9 / 16) * (9 / 16);
    const startPoint = camera.start.x! * (1 - wholeSide) + wholeSide / 2;
    expect((zoomed.output as { camera: { x: number } }).camera.x).toBeCloseTo(0.8, 2);
    expect(startPoint).toBeCloseTo(0.8, 2);
  });

  it('keeps where a framed shot looks when its camera is taken off, and refuses a move that would widen a closer framing', async () => {
    const { store, operation, shot } = setUp();
    store.patch({ video: { ...store.snapshot().video, layout: { width: 1920, height: 1080 } }, outputFrame: OutputFrame.original().withFormat('9:16') });
    await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1.5, x: 0.8, y: 0.3, sound: false });

    const widening = await operation.run({ target: shot.ref, preset: 'layer-zoom-in-camera', scale: 1.2 });
    const off = await operation.run({ target: shot.ref, preset: null });

    const camera = cameraOf(store, ShotVideoLayerId.of(shot.shot.id));
    const wholeSide = (9 / 16) * (9 / 16);
    expect(widening.ok).toBe(false);
    expect(widening.problems[0]?.message).toMatch(/would first widen it/);
    expect(off.ok).toBe(true);
    expect(camera.presetId).toBeNull();
    expect(camera.start.x! * (1 - wholeSide) + wholeSide / 2).toBeCloseTo(0.8, 2);
  });

  it('closes in on where a framing left the subject along the axis the frame shows whole, and keeps it through taking the camera off', async () => {
    const { store, operation, shot } = setUp();
    store.patch({ video: { ...store.snapshot().video, layout: { width: 1920, height: 1080 } }, outputFrame: OutputFrame.original().withFormat('9:16') });
    const styleId = ShotVideoLayerId.of(shot.shot.id);
    // A person framed across at 0.8 whose head is 0.3 of the way down a picture the frame shows whole from top to bottom.
    await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1, x: 0.8, sound: false });
    const framed = cameraOf(store, styleId).start;
    store.patch({ shots: store.snapshot().shots.withLayerStyles(store.snapshot().shots.layerStyles.withStyle(styleId, {
      ...store.snapshot().shots.layerStyles.get(styleId)!,
      fields: { ...store.snapshot().shots.layerStyles.get(styleId)!.fields, [ShotVideoFraming.POSITION_FIELD_IDS.y]: 0.3 },
    })) });

    const punched = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 1.25, sound: false });
    const close = cameraOf(store, styleId).start;
    await operation.run({ target: shot.ref, preset: null });
    const off = cameraOf(store, styleId).start;

    // A view 1 / 1.25 of the picture's height that leaves the point 0.3 where it was starts 0.3 of the way into what it leaves out.
    expect(close.y).toBeCloseTo(0.3, 3);
    expect((punched.output as { shows: string }).shows).toMatch(/6% to 86% of its height/);
    expect((punched.output as { camera: { x: number } }).camera.x).toBeCloseTo(0.8, 2);
    expect(off.y).toBeCloseTo(0.3, 3);
    expect(framed.y).toBeNull();
  });

  it('aims a shot at a point of the picture, kept there at another scale and stopped at the edge', async () => {
    const { operation, shot } = setUp();

    const aimed = await operation.run({ target: shot.ref, preset: 'layer-punch-in-camera', scale: 2, x: 0.3, y: 0.6 });
    const closer = await operation.run({ target: shot.ref, scale: 3 });
    const edge = await operation.run({ target: shot.ref, x: 0.05 });

    expect((aimed.output as { camera: object }).camera).toMatchObject({ scale: 2, x: 0.3, y: 0.6 });
    expect((closer.output as { camera: object }).camera).toMatchObject({ scale: 3, x: 0.3, y: 0.6 });
    // The frame is a third of the picture wide: its middle cannot come nearer the edge than a sixth.
    expect((edge.output as { camera: object }).camera).toMatchObject({ x: 0.17 });
  });
});
