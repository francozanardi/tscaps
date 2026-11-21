import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import { Document, type FootageLayer } from '@tscaps/engine';
import { CssBlockSealer, CssKeyframeNamespacer, CssMinifier } from '@tscaps/engine/advanced';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { ExportRenderContext } from '@core/export/domain/ExportRenderContributor';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotFootageLayerBuilder } from '@core/shots/services/ShotFootageLayerBuilder';
import { ShotGraphicFootageBuilder } from '@core/shots/services/ShotGraphicFootageBuilder';
import { ShotGraphicStageBuilder } from '@core/shots/services/ShotGraphicStageBuilder';
import { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicPlayer } from '@core/graphics/domain/GraphicPlayer';
import type { GraphicPlayerFactory } from '@core/graphics/domain/GraphicPlayerFactory';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';
import { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';
const LOWER_THIRD_GRAPHIC_PRESET = new BuiltinGraphicPresetCatalog().starter();
const STARTER_GRAPHIC = LOWER_THIRD_GRAPHIC_PRESET.graphic;
import { ShotLayerStageBuilder } from '@core/shots/services/ShotLayerStageBuilder';
import { ShotFollowCameraWriter } from '@core/shots/services/ShotFollowCameraWriter';
import { HeadFraming } from '@core/subject-tracking/services/HeadFraming';
import { CameraPathPlanner } from '@core/subject-tracking/services/CameraPathPlanner';
import { ShotFollowStager } from '@core/shots/services/ShotFollowStager';
import { ShotFollowCrop } from '@core/shots/services/ShotFollowCrop';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { ShotTransitionStyleWriter } from '@core/shots/services/ShotTransitionStyleWriter';
import { BUILTIN_SHOT_LAYER_STAGE_CSS } from '@core/shots/infrastructure/BuiltinShotLayerStageCss';
import { ShotTransitionLayerBuilder } from '@core/shots/services/ShotTransitionLayerBuilder';
import { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import { LineTypographyRereads } from '@core/elements/services/css/LineTypographyRereads';
import { ShotLayerExportContributor } from '@core/shots/services/ShotLayerExportContributor';
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { OutputFrameCss } from '@core/output-frame/services/OutputFrameCss';
import { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';

/**
 * The export burns each layer from the file as it was added, never its
 * proxy, reading each file once however many shots use it. A file that
 * cannot be had, or a GIF this browser cannot play, is left out and
 * named once, and its shots show the video. A graphic needs no file: it
 * is played over its whole shot, above the shot's files, at the size of
 * its box. How each is drawn is the stylesheet it carries, on a frame of
 * the video's size.
 */

const STAGES = new ShotLayerStageBuilder(
  new ElementCssLayerBuilder(new CssKeyframeNamespacer(), new CssMinifier(), new CssBlockSealer(), new CssKeyframesLifter(), new LineTypographyRereads()),
  new ShotTransitionStyleWriter(BUILTIN_SHOT_LAYER_STAGE_CSS), BUILTIN_SHOT_LAYER_STAGE_CSS,
  new OutputFrameCss(),
  new ShotFollowCameraWriter(),
);
const FOLLOWS = new ShotFollowStager(new ShotFollowCrop(new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS)), new CameraPathPlanner(new HeadFraming()));

/** Plays every GIF but the ones named. */
class NamedGifPlaybackProbe implements GifPlaybackProbe {
  constructor(private readonly unplayable: ReadonlySet<string> = new Set()) {}

  async ensurePlayable(gif: Blob): Promise<void> {
    if (this.unplayable.has(await gif.text())) throw new Error('No decoder here can read this GIF.');
  }
}

function mediaNamed(id: string): MediaAsset {
  return {
    id,
    type: 'video',
    owner: { kind: 'project', projectId: 'project' },
    fileName: `${id}.mp4`,
    mimeType: 'video/mp4',
    sizeBytes: 3,
    widthPx: 640,
    heightPx: 360,
    durationSec: 10,
  };
}

let layerCount = 0;

function layer(mediaId: string): ShotLayer {
  layerCount += 1;
  return { id: `layer ${layerCount}`, mediaId, inSec: 0, outSec: null, loop: false };
}

/** Opens every graphic as a player that draws nothing, keeping what each was opened with. */
class RecordingGraphicPlayers implements GraphicPlayerFactory {
  readonly opened: Array<{ document: GraphicDocument; stage: GraphicStage }> = [];

  open(document: GraphicDocument, stage: GraphicStage): Promise<GraphicPlayer> {
    this.opened.push({ document, stage });
    return Promise.resolve({ moments: [], frameAt: () => Promise.reject(new Error('Nothing is drawn here.')), frameOf: (sec) => sec, textLayout: () => null, dispose: () => undefined });
  }
}

function contributorReading(
  repository: RecordingRepository,
  gifs: GifPlaybackProbe = new NamedGifPlaybackProbe(),
  players: GraphicPlayerFactory = new RecordingGraphicPlayers(),
): ShotLayerExportContributor {
  return new ShotLayerExportContributor(
    repository as unknown as MediaAssetBytesRepository,
    new ShotLayerTiming(new ShotLayerAssetReader()),
    new ShotFootageLayerBuilder(),
    new VideoPictureFootageBuilder(),
    new ShotTransitionLayerBuilder(new ShotTransitionCuts()),
    STAGES,
    gifs,
    new ShotGraphicFootageBuilder(players, new ShotGraphicStageBuilder(new ShotLayerBoxShape()), new GraphicMessageLog(), { record: () => undefined }, { record: () => undefined }),
    FOLLOWS,
  );
}

class RecordingRepository {
  readonly reads: string[] = [];

  constructor(private readonly held: ReadonlySet<string>) {}

  load(mediaId: string, rendition: MediaAssetRendition): Promise<Blob | null> {
    this.reads.push(`${mediaId}/${rendition}`);
    return Promise.resolve(this.held.has(mediaId) ? new Blob([mediaId]) : null);
  }
}

/** A device still waiting for every file to come down. */
class NeverLandingRepository {
  load(): Promise<Blob | null> {
    return new Promise(() => {});
  }
}

function contextWith(
  shots: ShotPartition,
  extra: readonly MediaAsset[] = [],
  signal: AbortSignal = new AbortController().signal,
): ExportRenderContext {
  return {
    document: new Document({ sections: [] }),
    originalDocument: null,
    originalSheets: [],
    originalDecorationOverrides: DecorationOverrideRegistry.empty(),
    sheets: [],
    behindActorOverrides: BehindActorOverrideRegistry.empty(),
    projectId: 'project',
    shots,
    media: MediaAssetCatalog.of([mediaNamed('beach'), mediaNamed('gone'), ...extra]),
    cuts: CutRegistry.fromSnapshot([]),
    audio: AudioMix.empty(),
    videoDurationSec: 12,
    frameLayout: { width: 1080, height: 1920 },
    outputFrame: OutputFrame.original(),
    colorGrade: ColorGrade.neutral(),
    signal,
  };
}

describe('ShotLayerExportContributor', () => {
  it('stops waiting for a file once the run is abandoned', async () => {
    const run = new AbortController();
    const contributor = new ShotLayerExportContributor(
      new NeverLandingRepository() as unknown as MediaAssetBytesRepository,
      new ShotLayerTiming(new ShotLayerAssetReader()),
      new ShotFootageLayerBuilder(),
      new VideoPictureFootageBuilder(),
      new ShotTransitionLayerBuilder(new ShotTransitionCuts()),
      STAGES,
      new NamedGifPlaybackProbe(),
      new ShotGraphicFootageBuilder(new RecordingGraphicPlayers(), new ShotGraphicStageBuilder(new ShotLayerBoxShape()), new GraphicMessageLog(), { record: () => undefined }, { record: () => undefined }),
      FOLLOWS,
    );
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [layer('beach')] }] });

    const prepared = contributor.prepare(contextWith(shots, [], run.signal));
    run.abort();

    await expect(prepared).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('draws each layer from its original, reading a file once, and names a file that cannot be had once', async () => {
    const repository = new RecordingRepository(new Set(['beach']));
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer('beach')] },
        { id: 'b', startSec: 3 },
        { id: 'c', startSec: 5, layers: [layer('beach')] },
        { id: 'd', startSec: 8, layers: [layer('gone')] },
        { id: 'e', startSec: 10, layers: [layer('gone')] },
      ],
    });

    const contribution = await contributorReading(repository).prepare(contextWith(shots));

    expect((contribution.footage?.layers ?? []).map(({ outputStartSec, outputEndSec }: FootageLayer) => [outputStartSec, outputEndSec]))
      .toEqual([[0, 3], [5, 8]]);
    expect(contribution.unavailableFootage).toEqual(['gone.mp4']);
    expect(repository.reads).toEqual(['beach/original', 'gone/original']);
  });

  it('leaves out a layer whose file the catalog does not hold, even with bytes for it on the device, and names it', async () => {
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [layer('unlisted')] }] });

    const contribution = await contributorReading(new RecordingRepository(new Set(['unlisted']))).prepare(contextWith(shots));

    expect((contribution.footage?.layers ?? [])).toEqual([]);
    expect(contribution.unavailableFootage).toEqual(['unlisted']);
  });

  it('burns a picture and a GIF as what they are, each over its whole shot', async () => {
    const still = (id: string, type: 'image' | 'gif'): MediaAsset => ({ ...mediaNamed(id), type, durationSec: null });
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer('logo')] },
        { id: 'b', startSec: 4, layers: [layer('wave')] },
      ],
    });

    const contribution = await contributorReading(new RecordingRepository(new Set(['logo', 'wave'])))
      .prepare(contextWith(shots, [still('logo', 'image'), still('wave', 'gif')]));

    expect((contribution.footage?.layers ?? []).map(({ source, outputStartSec, outputEndSec }: FootageLayer) => [source.kind, outputStartSec, outputEndSec]))
      .toEqual([['image', 0, 4], ['gif', 4, 12]]);
  });

  it('plays a graphic over its whole shot, above its files, at the size of its box, with its fields\' values', async () => {
    const players = new RecordingGraphicPlayers();
    const graphic = { ...STARTER_GRAPHIC, params: { title: 'Ada' } };
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [{ id: 'graphic', graphic }, layer('beach')] }, { id: 'b', startSec: 4 }],
    });

    const contribution = await contributorReading(new RecordingRepository(new Set(['beach'])), undefined, players).prepare(contextWith(shots));
    const layers = contribution.footage?.layers ?? [];
    const drawn = layers.at(-1)!;
    if (drawn.source.kind !== 'provided') throw new Error('The graphic is not drawn from what it provides.');
    await (await drawn.source.provider.open(1)).close();

    expect(layers.map(({ id, source, outputStartSec, outputEndSec }) => [id, source.kind, outputStartSec, outputEndSec]))
      .toEqual([['layer ' + layerCount, 'video', 0, 4], ['graphic', 'provided', 0, 4]]);
    // With no layout of its own, a layer covers the frame: 1080 × 1920.
    expect(players.opened.map(({ document, stage }) => [document, stage.widthPx, stage.heightPx, stage.durationSec, stage.params]))
      .toEqual([[STARTER_GRAPHIC.document, 1080, 1920, 4, { title: 'Ada', subtitle: 'What you do', accent: '#7c5cff' }]]);
  });

  it('leaves out a GIF this browser cannot play and names it, rather than burning a still of it', async () => {
    const gif = (id: string): MediaAsset => ({ ...mediaNamed(id), type: 'gif', fileName: `${id}.gif`, durationSec: null });
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0, layers: [layer('wave')] },
        { id: 'b', startSec: 4, layers: [layer('spin')] },
      ],
    });

    const contribution = await contributorReading(new RecordingRepository(new Set(['wave', 'spin'])), new NamedGifPlaybackProbe(new Set(['spin'])))
      .prepare(contextWith(shots, [gif('wave'), gif('spin')]));

    expect((contribution.footage?.layers ?? []).map(({ source, outputStartSec }: FootageLayer) => [source.kind, outputStartSec])).toEqual([['gif', 0]]);
    expect(contribution.unavailableFootage).toEqual(['spin.gif']);
  });

  it('draws every layer it plays by one stylesheet, on a frame of the video\'s size', async () => {
    const shots = ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [{ id: 'a', startSec: 0, layers: [layer('beach')] }, { id: 'b', startSec: 4, layers: [layer('beach')] }],
    });

    const contribution = await contributorReading(new RecordingRepository(new Set(['beach']))).prepare(contextWith(shots));
    const { layers, style } = contribution.footage!;

    expect(layers).toHaveLength(2);
    expect([style.frameWidth, style.frameHeight]).toEqual([1080, 1920]);
  });

  it('draws nothing where no layer can be drawn', async () => {
    const shots = ShotPartition.fromSnapshot({ maxShotSec: 6, shots: [{ id: 'a', startSec: 0, layers: [layer('gone')] }] });

    const contribution = await contributorReading(new RecordingRepository(new Set())).prepare(contextWith(shots));

    expect(contribution.footage).toBeNull();
  });

  it('hands the engine a grade over the picture, even with nothing on any shot', async () => {
    const contributor = contributorReading(new RecordingRepository(new Set()));
    const grade = ColorGrade.neutral().with('temperature', 0.5);

    const contribution = await contributor.prepare({ ...contextWith(ShotPartition.empty()), colorGrade: grade });

    expect(contribution.footage?.layers).toEqual([]);
    expect(contribution.footage?.grade).toEqual(grade.toFootageGrade());
    expect((await contributor.prepare(contextWith(ShotPartition.empty()))).footage).toBeNull();
  });
});

