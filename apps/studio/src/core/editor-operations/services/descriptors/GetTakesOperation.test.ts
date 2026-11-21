import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import { GetTakesOperation } from '@core/editor-operations/services/descriptors/GetTakesOperation';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { EditTakes } from '@core/shots/services/EditTakes';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';

/**
 * The pace of an edit read back: what a viewer sees as one picture is
 * one take, however many shots it is made of.
 */

const layouts = new TestShotLayerLayouts().writer;

/** 40 s of one camera in four shots: a b-roll over the whole frame on the second, a picture set over the video on the third. */
function setUp(ownChanges: PictureChangeReader = { read: async () => [] }) {
  const store = new EditorStore();
  const partition = ShotPartition.fromSnapshot({
    maxShotSec: 10,
    shots: [
      { id: 'a', startSec: 0, layers: [] },
      { id: 'b', startSec: 10, layers: [{ id: 'broll', mediaId: 'clip', inSec: 0, outSec: null, loop: false }] },
      { id: 'c', startSec: 14, layers: [{ id: 'sticker', mediaId: 'mark', inSec: 0, outSec: null, loop: false }] },
      { id: 'd', startSec: 30, layers: [] },
    ],
  });
  const inset = { kind: 'inset', subject: 'asset', centerX: 0.5, centerY: 0.3, width: 0.3, aspectRatio: null, padding: 0, cornerRadius: 0, fit: 'cover' } as const;
  store.patch({
    video: { ...store.snapshot().video, duration: 40 },
    shots: partition.withLayerStyles(layouts.written(partition.layerStyles, 'sticker', inset)),
  });
  const parser = new EditorRefParser();
  const materializer = new ShotPartitionMaterializer(
    new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
    new OriginalCaptionTrackReader(),
  );
  const operation = new GetTakesOperation(store, new ShotRefResolver(store, materializer, parser), ownChanges, new EditTakes(), parser, new ReadoutFormatter());
  return { store, operation };
}

describe('get_takes', () => {
  it('lists what the viewer sees as one picture as one take, and names the longest stretch of the video', async () => {
    const result = await setUp().operation.run({});

    expect(result.output).toEqual({
      takes: [
        { fromSec: 0, toSec: 10, seconds: 10, picture: 'video' },
        { fromSec: 10, toSec: 14, seconds: 4, picture: 'layer:broll' },
        { fromSec: 14, toSec: 40, seconds: 26, picture: 'video' },
      ],
      count: 3,
      longestOfVideo: { fromSec: 14, toSec: 40, seconds: 26, picture: 'video' },
    });
    expect(result.problems).toEqual([]);
  });

  it('ends a take of the video where the video changes camera by itself, and lists only the long ones when asked', async () => {
    const result = await setUp({ read: async () => [34] }).operation.run({ atLeastSec: 15 });

    expect(result.output).toMatchObject({
      takes: [{ fromSec: 14, toSec: 34, seconds: 20, picture: 'video' }],
      count: 4,
      longestOfVideo: { fromSec: 14, toSec: 34 },
    });
  });

  it('still reads the takes from the layers where the video\'s own changes cannot be read, and says so', async () => {
    const unreadable: PictureChangeReader = { read: async () => { throw new Error('No video is loaded'); } };

    const result = await setUp(unreadable).operation.run({});

    expect(result.ok).toBe(true);
    expect((result.output as { count: number }).count).toBe(3);
    expect(result.problems[0]).toMatchObject({ severity: 'warning' });
  });
});
