import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';
import { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import { SplitShotBeforeWordAction } from '@core/shots/actions/SplitShotBeforeWordAction';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import { MoveShotStartToWordAction } from '@core/shots/actions/MoveShotStartToWordAction';

/**
 * A shot opened on a word by hand — split there, or a word handed to the
 * shot before or after — opens where a proposed shot would: inside the
 * silence before the word, on the video's own edit where it has one
 * there, a little ahead of the word otherwise.
 */

const VIDEO_END = 24;

/** Word `w<n>` is said from `2n` to `2n + 1.5`, so half a second of silence precedes each. */
function speech(): Document {
  const segments = Array.from({ length: 12 }, (_, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({
      id: `w${index}`,
      text: `w${index}`,
      time: new TimeFragment(index * 2, index * 2 + 1.5),
    })] })],
  }));
  return new Document({ sections: [new Section({ kind: 'main', segments })] });
}

const reader = new OriginalCaptionTrackReader();
const locator = new PictureChangeLocator();
const placer = new ShotOpeningPlacer();
const materializer = new ShotPartitionMaterializer(
  new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), locator), placer, new CutAwareDocumentBuilder()),
  reader,
);
const openings = new ShotWordOpeningResolver(reader, locator, placer);

/**
 * An editor whose shots were already made the user's own, before the
 * picture was read: the proposal had no say over where the video changes
 * picture, so every cut there comes from the gesture under test.
 */
function editorWith(pictureChangesSec: ReadonlyArray<number> | null = null): EditorStore {
  const store = new EditorStore();
  store.patch({ document: speech(), video: { ...store.snapshot().video, duration: VIDEO_END } });
  store.patch({ shots: materializer.materializeFrom(store.snapshot()) });
  store.patchVideo({ pictureChangesSec });
  return store;
}

function splitBefore(store: EditorStore, wordId: string): void {
  new SplitShotBeforeWordAction(store, openings, new SplitShotAction(store, materializer, new RecordingShotTelemetry().edits)).execute(wordId);
}

function moveStartTo(store: EditorStore, shotId: string, wordId: string): void {
  new MoveShotStartToWordAction(store, openings, new MoveShotStartAction(store, materializer, new RecordingShotTelemetry().edits)).execute(shotId, wordId);
}

const openingsOf = (store: EditorStore): number[] => store.snapshot().shots.list().map((shot) => shot.startSec);

/** The shot that opens in the silence before word `w<n>`. */
function shotOpeningBefore(store: EditorStore, index: number) {
  const opening = openingBeforeWord(store, index);
  return store.snapshot().shots.list().find((shot) => shot.startSec === opening)!;
}

/** The opening that falls in the silence before word `w<n>`, from `2n - 0.5` to `2n`. */
function openingBeforeWord(store: EditorStore, index: number): number | undefined {
  return openingsOf(store).find((sec) => sec >= index * 2 - 0.5 - 0.05 && sec <= index * 2 + 0.05);
}

describe('opening a shot on a word by hand', () => {
  it('splits in the silence before the word, a little ahead of it', () => {
    const store = editorWith();

    splitBefore(store, 'w5');

    const opening = openingBeforeWord(store, 5)!;
    expect(opening).toBeGreaterThan(9.5);
    expect(opening).toBeLessThan(10);
  });

  it('splits where the video already changes picture inside that silence', () => {
    const store = editorWith([4.1, 9.6, 20.2]);

    splitBefore(store, 'w5');

    expect(openingsOf(store)).toContain(9.6);
  });

  it('hands the first word of a shot to the shot before it, cutting where the video changes picture', () => {
    // The shot opening before w4 holds w4 and w5; w4 goes back, and the
    // shot opens before w5, on the edit the video has there.
    const store = editorWith([9.7]);
    const shot = shotOpeningBefore(store, 4);

    moveStartTo(store, shot.id, 'w5');

    expect(openingsOf(store)).toContain(9.7);
    expect(openingBeforeWord(store, 4)).toBeUndefined();
  });

  it('hands the last word of a shot to the shot after it, cutting a little ahead of that word', () => {
    // The shot opening before w2 holds w2 and w3; w3 goes forward.
    const store = editorWith();
    const next = shotOpeningBefore(store, 4);

    moveStartTo(store, next.id, 'w3');

    const opening = openingBeforeWord(store, 3)!;
    expect(opening).toBeGreaterThan(5.5);
    expect(opening).toBeLessThan(6);
  });

  it('does nothing for a word the video does not say', () => {
    const store = editorWith();
    const before = openingsOf(store);

    splitBefore(store, 'missing');

    expect(openingsOf(store)).toEqual(before);
  });
});
