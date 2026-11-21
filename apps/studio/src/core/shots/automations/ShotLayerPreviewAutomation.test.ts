import { describe, expect, it } from 'vitest';
import { ShotTransitionCuts } from '@core/shots/services/ShotTransitionCuts';
import {
  type FootageLayer,
  type FootageSource,
  type FootageStyle,
} from '@tscaps/engine';
import {
  CssBlockSealer,
  CssKeyframeNamespacer,
  CssMinifier,
  type FootageLayerResolver,
  type FootageLayerResolverFactory,
  type ResolvedFootageLayer,
} from '@tscaps/engine/advanced';
import { CssKeyframesLifter } from '@core/elements/services/css/CssKeyframesLifter';
import { ElementCssLayerBuilder } from '@core/elements/services/css/ElementCssLayerBuilder';
import { LineTypographyRereads } from '@core/elements/services/css/LineTypographyRereads';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { GifPlaybackProbe } from '@core/media/domain/GifPlaybackProbe';
import type { MediaAssetRendition } from '@core/media/domain/MediaAssetRendition';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetProxyCache } from '@core/media/services/MediaAssetProxyCache';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type { VideoPreviewSurface } from '@core/preview/domain/VideoPreviewSurface';
import { ShotLayerPreviewAutomation } from '@core/shots/automations/ShotLayerPreviewAutomation';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotGraphicFootageBuilder } from '@core/shots/services/ShotGraphicFootageBuilder';
import { ShotGraphicStageBuilder } from '@core/shots/services/ShotGraphicStageBuilder';
import { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import { ShotLayerBoxShape } from '@core/shots/domain/ShotLayerBoxShape';
import { ShotFootageLayerBuilder } from '@core/shots/services/ShotFootageLayerBuilder';
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
import { ShotLayerTiming } from '@core/shots/services/ShotLayerTiming';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { ShotLayerPreviewFootageStore } from '@core/shots/store/ShotLayerPreviewFootageStore';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OutputFrameCss } from '@core/output-frame/services/OutputFrameCss';
import { VideoPictureFootageBuilder } from '@core/shots/services/VideoPictureFootageBuilder';

/**
 * The preview shows a layer only once its file is ready, from its
 * proxy, where the export places it; until then the video shows there.
 * A file answers with the same bytes from one update to the next, so an
 * edit elsewhere never makes the preview open a file again. A GIF this
 * browser cannot play is never ready, so the video shows there rather
 * than a still of it. How each layer is drawn is resolved from a
 * stylesheet of the frame's size, written again whenever a layer
 * changes; the resolver it replaces is let go, and the footage store
 * holds the one the surface draws with.
 */

const CLIP: MediaAsset = {
  id: 'clip',
  type: 'video',
  owner: { kind: 'project', projectId: 'project' },
  fileName: 'clip.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 3,
  widthPx: 640,
  heightPx: 360,
  durationSec: 2,
};

const LOOP: MediaAsset = {
  ...CLIP,
  id: 'loop',
  type: 'gif',
  fileName: 'loop.gif',
  mimeType: 'image/gif',
  durationSec: null,
};

/** Plays every GIF, or none: a browser with no decoder able to read them. */
class FixedGifPlaybackProbe implements GifPlaybackProbe {
  constructor(private readonly plays: boolean) {}

  async ensurePlayable(): Promise<void> {
    if (!this.plays) throw new Error('No decoder here can read this GIF.');
  }
}

class InMemoryRepository {
  readonly held = new Map<string, Blob>();

  load(mediaId: string, rendition: MediaAssetRendition): Promise<Blob | null> {
    return Promise.resolve(this.held.get(`${mediaId}/${rendition}`) ?? null);
  }
}

class RecordingSurface {
  layers: ReadonlyArray<FootageLayer> = [];
  footage: PreviewFootage | null = null;

  setFootage(footage: PreviewFootage): void {
    this.footage = footage;
    this.layers = footage.layers;
  }
}

/** A resolver that answers nothing, and says whether it was let go. */
class RecordingResolver implements FootageLayerResolver {
  disposed = false;

  constructor(readonly style: FootageStyle) {}

  resolveAt(): ReadonlyArray<ResolvedFootageLayer> {
    return [];
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** Opens recording resolvers, and keeps every one it opened. */
class RecordingResolverFactory implements FootageLayerResolverFactory {
  readonly opened: RecordingResolver[] = [];

  open(_layers: ReadonlyArray<FootageLayer>, style: FootageStyle): FootageLayerResolver {
    const resolver = new RecordingResolver(style);
    this.opened.push(resolver);
    return resolver;
  }
}

/** The file a layer plays, or undefined where there is no layer or it shows the video's own picture. */
function harness({ gifPlays = true }: { gifPlays?: boolean } = {}) {
  const repository = new InMemoryRepository();
  repository.held.set('clip/proxy', new Blob(['proxy']));
  repository.held.set('loop/original', new Blob(['gif']));
  const store = new EditorStore();
  const assets = new MediaAssetStore();
  assets.put(CLIP);
  assets.put(LOOP);
  store.patch({
    projectId: 'project',
    shots: ShotPartition.fromSnapshot({
      maxShotSec: 6,
      shots: [
        { id: 'a', startSec: 0 },
        { id: 'b', startSec: 4, layers: [{ id: 'layer', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
      ],
    }),
  });
  const preparer = new MediaAssetPreparer(
    repository as unknown as MediaAssetBytesRepository,
    {} as PreviewProxyGenerator,
    new DeviceOnlyMediaAssetUploader(),
    new FixedGifPlaybackProbe(gifPlays),
    { ensurePlayable: async () => undefined },
  );
  const surface = new RecordingSurface();
  const resolvers = new RecordingResolverFactory();
  const footage = new ShotLayerPreviewFootageStore();
  const lifter = new CssKeyframesLifter();
  const automation = new ShotLayerPreviewAutomation(
    store,
    surface as unknown as VideoPreviewSurface,
    new ShotLayerTiming(new ShotLayerAssetReader()),
    new ShotFootageLayerBuilder(),
    new VideoPictureFootageBuilder(),
    new ShotTransitionLayerBuilder(new ShotTransitionCuts()),
    new ShotLayerStageBuilder(
      new ElementCssLayerBuilder(new CssKeyframeNamespacer(), new CssMinifier(), new CssBlockSealer(), lifter, new LineTypographyRereads()),
      new ShotTransitionStyleWriter(BUILTIN_SHOT_LAYER_STAGE_CSS), BUILTIN_SHOT_LAYER_STAGE_CSS,
      new OutputFrameCss(),
      new ShotFollowCameraWriter(),
    ),
    resolvers,
    footage,
    assets,
    preparer,
    new MediaAssetProxyCache(repository as unknown as MediaAssetBytesRepository, assets),
    new ShotGraphicFootageBuilder(
      { open: () => Promise.reject(new Error('No graphic plays here.')) },
      new ShotGraphicStageBuilder(new ShotLayerBoxShape()),
      new GraphicMessageLog(),
      { record: () => undefined },
      { record: () => undefined },
    ),
    new ShotFollowStager(new ShotFollowCrop(new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS)), new CameraPathPlanner(new HeadFraming())),
  );
  return { store, assets, preparer, surface, resolvers, footage, automation };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ShotLayerPreviewAutomation', () => {
  it('shows nothing for a file that is not ready, then its proxy where its shot opens', async () => {
    const { preparer, surface, automation } = harness();
    automation.start();
    await settle();

    expect(surface.layers).toEqual([]);

    await preparer.ensurePrepared([CLIP], new Set(['clip']));
    await settle();

    expect(surface.layers.map(({ outputStartSec, outputEndSec }) => [outputStartSec, outputEndSec])).toEqual([[4, 6]]);
    expect(await blobOf(surface.layers[0]?.source).text()).toBe('proxy');
  });

  it('shows the video where a layer names a file the catalog no longer holds', async () => {
    const { preparer, surface, automation, assets } = harness();
    automation.start();
    await preparer.ensurePrepared([CLIP], new Set(['clip']));
    await settle();

    assets.remove('clip');
    await settle();

    expect(surface.layers).toEqual([]);
  });

  it('keeps showing the same bytes across an edit that moves the layer', async () => {
    const { store, preparer, surface, automation } = harness();
    automation.start();
    await preparer.ensurePrepared([CLIP], new Set(['clip']));
    await settle();
    const before = blobOf(surface.layers[0]?.source);

    store.patch({ shots: store.snapshot().shots.moveStart('b', 3) });
    await settle();

    expect(surface.layers[0]?.outputStartSec).toBe(3);
    expect(blobOf(surface.layers[0]?.source)).toBe(before);
  });

  it('resolves the layers from a new stylesheet when a layout changes, of the frame\'s size once it is known', async () => {
    const { store, preparer, surface, footage, automation } = harness();
    automation.start();
    await preparer.ensurePrepared([CLIP], new Set(['clip']));
    await settle();
    const styleNow = (): FootageStyle | undefined => (surface.footage?.resolver as RecordingResolver | undefined)?.style;
    const before = styleNow();

    store.patch({ shots: new TestShotLayerLayouts().writer.withLayout(store.snapshot().shots, 'layer', {
      kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.5, width: 0.5, aspectRatio: 1, padding: 0, cornerRadius: 0, fit: 'cover',
    }) });
    await settle();
    expect(styleNow()?.css).not.toBe(before?.css);
    expect(footage.snapshot()).toBe(surface.footage);

    store.patch({ video: { ...store.snapshot().video, layout: { width: 1000, height: 2000 } } });
    await settle();
    expect([styleNow()?.frameWidth, styleNow()?.frameHeight]).toEqual([1000, 2000]);
  });

  it('lets go of every resolver it replaces, and of the last one once stopped', async () => {
    const { store, preparer, resolvers, footage, automation } = harness();
    automation.start();
    await preparer.ensurePrepared([CLIP], new Set(['clip']));
    store.patch({ shots: store.snapshot().shots.moveStart('b', 3) });
    await settle();

    expect(resolvers.opened.slice(0, -1).every((resolver) => resolver.disposed)).toBe(true);
    expect(resolvers.opened.at(-1)?.disposed).toBe(false);

    automation.stop();

    expect(resolvers.opened.at(-1)?.disposed).toBe(true);
    expect(footage.snapshot()).toBeNull();
  });

  it('shows the video, not a still, where a GIF cannot play in this browser', async () => {
    const showsGif = async (gifPlays: boolean) => {
      const { store, preparer, surface, automation } = harness({ gifPlays });
      store.patch({ shots: store.snapshot().shots.withLayerAdded('a', {
        id: 'gif-layer', mediaId: 'loop', inSec: 0, outSec: null, loop: false,

      }) });
      automation.start();
      await preparer.ensurePrepared([CLIP, LOOP], new Set(['clip', 'loop']));
      await settle();
      return surface.layers.some((layer) => layer.source.kind === 'gif');
    };

    expect(await showsGif(true)).toBe(true);
    expect(await showsGif(false)).toBe(false);
  });
});

function blobOf(source: FootageSource | undefined): Blob {
  if (source === undefined || source.kind === 'backdrop' || source.kind === 'source-picture' || source.kind === 'provided') throw new Error('Expected a layer read from a file.');
  return source.blob;
}
