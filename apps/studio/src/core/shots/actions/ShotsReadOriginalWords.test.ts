import { describe, expect, it } from 'vitest';
import { RecordingShotTelemetry } from '@core/shots/testing/RecordingShotTelemetry';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { Document, Line, Section, Segment, TimeFragment, Word } from '@tscaps/engine';
import { EditorStore } from '@core/editor/store/EditorStore';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';
import { CaptionTrack, ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { SentenceBoundaryClassifier } from '@core/shots/services/SentenceBoundaryClassifier';
import { ShotBoundaryFinder } from '@core/shots/services/ShotBoundaryFinder';
import { PictureChangeLocator } from '@core/shots/services/PictureChangeLocator';
import { ShotOpeningPlacer } from '@core/shots/services/ShotOpeningPlacer';
import { ShotPartitioner } from '@core/shots/services/ShotPartitioner';
import { ShotPartitionMaterializer } from '@core/shots/services/ShotPartitionMaterializer';
import { ShotResolver } from '@core/shots/services/ShotResolver';
import { SplitShotAction } from '@core/shots/actions/SplitShotAction';
import { SplitShotBeforeWordAction } from '@core/shots/actions/SplitShotBeforeWordAction';
import { ShotWordOpeningResolver } from '@core/shots/services/ShotWordOpeningResolver';
import { MoveShotStartAction } from '@core/shots/actions/MoveShotStartAction';
import type { ResolvedShot } from '@core/shots/domain/ResolvedShot';

/**
 * Shots are about the video, not the captions: they show, and are cut
 * at, what is said in it — the Original track's words — whatever
 * caption track is active.
 */

const VIDEO_END = 24;
const SPOKEN = ['one.', 'two.', 'three.', 'four.', 'five.', 'six.', 'seven.', 'eight.', 'nine.', 'ten.', 'eleven.', 'twelve.'];
const TRANSLATED = ['uno.', 'dos.', 'tres.', 'cuatro.', 'cinco.', 'seis.', 'siete.', 'ocho.', 'nueve.', 'diez.', 'once.', 'doce.'];

/** One sentence every two seconds; a translation's times are approximated, here shifted. */
function documentOf(texts: ReadonlyArray<string>, shiftSec: number): Document {
  const segments = texts.map((text, index) => new Segment({
    id: `s${index}`,
    lines: [new Line({ words: [new Word({ text, time: new TimeFragment(index * 2 + shiftSec, index * 2 + 1.5 + shiftSec) })] })],
  }));
  return new Document({ sections: [new Section({ kind: 'main', segments })] });
}

function translation(document: Document): CaptionTrack {
  return new CaptionTrack({
    id: 'translation-es',
    name: 'Spanish',
    kind: 'translation',
    sourceTrackId: ORIGINAL_CAPTION_TRACK_ID,
    document,
    sheets: [],
    activeSheetId: null,
    behindActorOverrides: BehindActorOverrideRegistry.empty(),
    frozenSegments: FrozenSegmentSet.empty(),
    elementStyles: ElementStyles.empty(),
    decorationOverrides: DecorationOverrideRegistry.empty(),
    segmentVisibilityOverrides: SegmentVisibilityOverrideRegistry.empty(),
    hideBriefScenes: true,
  });
}

function editorWithSpeech(): EditorStore {
  const store = new EditorStore();
  store.patch({
    document: documentOf(SPOKEN, 0),
    video: { ...store.snapshot().video, duration: VIDEO_END },
  });
  return store;
}

function editorWithTranslationActive(): EditorStore {
  const store = editorWithSpeech();
  store.addCaptionTrack(translation(documentOf(TRANSLATED, 0.3)));
  return store;
}

const reader = new OriginalCaptionTrackReader();
const resolver = new ShotResolver();
const materializer = new ShotPartitionMaterializer(
  new ShotPartitioner(new ShotBoundaryFinder(new SentenceBoundaryClassifier(), new PictureChangeLocator()), new ShotOpeningPlacer(), new CutAwareDocumentBuilder()),
  reader,
);

/** What the Shots tab shows for this state. */
function shotsShown(store: EditorStore): ResolvedShot[] {
  const state = store.snapshot();
  const { document } = reader.read(state);
  return resolver.resolve(materializer.materializeFrom(state), document, state.video.duration);
}

const wordsOf = (shots: ReadonlyArray<ResolvedShot>): string[] => shots.flatMap((shot) => shot.pieces.map((piece) => piece.text));
const openingsOf = (store: EditorStore): number[] => store.snapshot().shots.list().map((shot) => shot.startSec);

describe('shots with a translation active', () => {
  it('show the Original words, at their own times', () => {
    const store = editorWithTranslationActive();
    expect(store.snapshot().activeCaptionTrackId).toBe('translation-es');

    const pieces = shotsShown(store).flatMap((shot) => shot.pieces);

    expect(pieces.map((piece) => piece.text)).toEqual(SPOKEN);
    expect(pieces.map((piece) => piece.startSec)).toEqual(SPOKEN.map((_, index) => index * 2));
  });

  it('are proposed from the Original words, the same as with no translation', () => {
    expect(shotsShown(editorWithTranslationActive()).map((shot) => shot.startSec))
      .toEqual(shotsShown(editorWithSpeech()).map((shot) => shot.startSec));
  });

  it('split at a word where the Original word is said', () => {
    const store = editorWithTranslationActive();
    const word = shotsShown(store).flatMap((shot) => shot.pieces).find((piece) => piece.text === 'four.')!;
    expect(shotsShown(store).some((shot) => shot.startSec > 5.5 && shot.startSec <= 6)).toBe(false);

    new SplitShotAction(store, materializer, new RecordingShotTelemetry().edits).execute(word.startSec);

    expect(openingsOf(store)).toContain(6);
    expect(openingsOf(store)).not.toContain(6.3);
  });

  it('split before a word in the silence before the Original word, not the translated one', () => {
    const store = editorWithTranslationActive();
    const word = shotsShown(store).flatMap((shot) => shot.pieces).find((piece) => piece.text === 'four.')!;
    const openings = new ShotWordOpeningResolver(reader, new PictureChangeLocator(), new ShotOpeningPlacer());
    expect(shotsShown(store).some((shot) => shot.startSec > 5.5 && shot.startSec <= 6)).toBe(false);

    new SplitShotBeforeWordAction(store, openings, new SplitShotAction(store, materializer, new RecordingShotTelemetry().edits)).execute(word.wordId);

    // The Original "three." ends at 5.5 and "four." starts at 6.
    expect(openingsOf(store).some((sec) => sec > 5.5 && sec < 6)).toBe(true);
  });

  it('keep the shots a split made from the Original words when the translation is left', () => {
    const store = editorWithTranslationActive();
    new SplitShotAction(store, materializer, new RecordingShotTelemetry().edits).execute(6);
    const withTranslation = openingsOf(store);

    store.setActiveCaptionTrack(ORIGINAL_CAPTION_TRACK_ID);

    expect(openingsOf(store)).toEqual(withTranslation);
    expect(wordsOf(shotsShown(store))).toEqual(SPOKEN);
  });

  it('move a shot to a word where the Original word is said', () => {
    const store = editorWithTranslationActive();
    const [, second] = shotsShown(store);
    const word = shotsShown(store).flatMap((shot) => shot.pieces).find((piece) => piece.startSec > second!.startSec)!;

    new MoveShotStartAction(store, materializer, new RecordingShotTelemetry().edits).execute(second!.id, word.startSec);

    expect(SPOKEN.map((_, index) => index * 2)).toContain(openingsOf(store)[1]);
  });
});

describe('shots with no translation', () => {
  it('read the words the editor shows, the very same document', () => {
    const store = editorWithSpeech();
    const state = store.snapshot();

    expect(reader.read(state).document).toBe(state.document);
    expect(reader.read(state).sheets).toBe(state.sheets);
    expect(wordsOf(shotsShown(store))).toEqual(SPOKEN);
  });
});
