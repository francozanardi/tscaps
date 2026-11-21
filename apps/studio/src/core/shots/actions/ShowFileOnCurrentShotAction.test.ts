import type { ShotFileLayer } from '@core/shots/domain/ShotLayer';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { describe, expect, it } from 'vitest';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { ShotsOnlyLayoutFollower } from '@core/shots/testing/ShotsOnlyLayoutFollower';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ShowFileOnCurrentShotAction } from '@core/shots/actions/ShowFileOnCurrentShotAction';
import { ShowFileOnShotAction } from '@core/shots/actions/ShowFileOnShotAction';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { ShotLayerAssetReader } from '@core/shots/services/ShotLayerAssetReader';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { ShotFilePlaybackCheck } from '@core/shots/services/ShotFilePlaybackCheck';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';

/**
 * The way to put a file on a shot without dragging it there: the shot
 * the reader is looking at is the one under the playhead.
 */

function editorAt(currentTime: number, withSpeech = true): EditorStore {
  const store = new EditorStore();
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ text: `w${index}.`, time: new TimeFragment(index * 2, index * 2 + 1.5) })] })],
  }));
  store.patch({
    document: withSpeech ? new Document({ sections: [new Section({ kind: 'main', segments })] }) : null,
    video: { ...store.snapshot().video, duration: withSpeech ? 24 : 0, currentTime },
  });
  return store;
}

function actionFor(store: EditorStore): ShowFileOnCurrentShotAction {
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const media = new MediaAssetStore();
  media.put({
    id: 'clip', type: 'video', owner: { kind: 'library' }, fileName: 'clip.mp4', mimeType: 'video/mp4',
    sizeBytes: 1, widthPx: 100, heightPx: 100, durationSec: 5,
  });
  const preparer = new MediaAssetPreparer(
    {} as MediaAssetBytesRepository,
    {} as PreviewProxyGenerator,
    new DeviceOnlyMediaAssetUploader(),
    { ensurePlayable: async () => undefined },
    { ensurePlayable: async () => undefined },
  );
  const showFile = new ShowFileOnShotAction(store, materializer, media, new ShotLayerAssetReader(), new ShotFilePlaybackCheck(media, preparer), new TestShotLayerLayouts().writer, new ShotsOnlyLayoutFollower(),
    new RecordingShotTelemetry().edits,
  );
  return new ShowFileOnCurrentShotAction(store, materializer, showFile);
}

describe('showing a file on the current shot', async () => {
  it('puts it on the shot under the playhead and on no other', async () => {
    const store = editorAt(13);

    const shotId = await actionFor(store).execute('clip');

    const shots = store.snapshot().shots;
    const showing = shots.list().filter((shot) => shot.layers.some((layer) => (layer as ShotFileLayer).mediaId === 'clip'));
    expect(showing.map((shot) => shot.id)).toEqual([shotId]);
    expect(shots.at(13)?.id).toBe(shotId);
  });

  it('does nothing where there are no shots yet', async () => {
    const store = editorAt(0, false);

    expect(await actionFor(store).execute('clip')).toBeNull();
    expect(store.snapshot().shots.isEmpty()).toBe(true);
  });
});
