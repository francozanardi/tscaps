import { describe, expect, it } from 'vitest';
import {
  BidiJsCharacterClassifier,
  Decoration,
  Document,
  Line,
  Section,
  Segment,
  StrongCharacterMajorityTextDirectionDetector,
  TimeFragment,
  Word,
} from '@tscaps/engine';
import {
  HorizontalPlacementResolver,
  HorizontalSideResolver,
} from '@tscaps/engine/advanced';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { AudioMixPruner } from '@core/audio-mix/services/AudioMixPruner';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { DocumentElementIdCollector } from '@core/captions/services/DocumentElementIdCollector';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { FontStackLibrary } from '@core/fonts/domain/FontStackLibrary';
import { StoredFontStackReader } from '@core/fonts/services/StoredFontStackReader';
import type { Project } from '@core/projects/domain/Project';
import { ProjectFromEditorStateBuilder } from '@core/projects/services/ProjectFromEditorStateBuilder';
import { PROJECT_SCHEMA_VERSION, ProjectSerializer } from '@core/projects/services/ProjectSerializer';
import { ProjectMigrator } from '@core/projects/services/migrations/ProjectMigrator';
import { TypographyConfigSerializer } from '@core/sheets/services/TypographyConfigSerializer';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { TestShotLayerLayouts } from '@core/shots/testing/TestShotLayerLayouts';
import { CaptionTrack } from '@core/translations/domain/CaptionTrack';
import { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import { TestCaptionCss } from '@core/captions/testing/TestCaptionCss';
import { AddReviewNoteAction } from '@core/review-notes/actions/AddReviewNoteAction';
import { SubmitReviewBatchAction } from '@core/review-notes/actions/SubmitReviewBatchAction';
import { ReviewBatchChannel } from '@core/review-notes/services/ReviewBatchChannel';

/**
 * A project's soundtrack survives a save and a load, and what is stored
 * is what can still play: a clip whose start is anchored to something
 * that is gone is not carried into storage, where no undo could bring
 * its anchor back.
 */

const layouts = new TestShotLayerLayouts();
const captionCss = new TestCaptionCss();
const serializer = new ProjectSerializer(
  { resolve: () => Promise.reject(new Error('No template is read by these projects.')) },
  new ProjectMigrator(
    layouts.catalog,
    layouts.controls,
    new HorizontalPlacementResolver(new HorizontalSideResolver()),
    captionCss.animationCssWriter,
    captionCss.animationCssBuilder,
  ),
  new StrongCharacterMajorityTextDirectionDetector(new BidiJsCharacterClassifier()),
  new DocumentElementIdCollector(),
  new TypographyConfigSerializer(),
  new StoredFontStackReader(new FontStackLibrary()),
  new AudioMixPruner(new OriginalCaptionTrackReader()),
);

function documentOf(wordIds: ReadonlyArray<string>): Document {
  return new Document({
    sections: [new Section({
      kind: 'main',
      segments: [new Segment({
        lines: [new Line({ words: wordIds.map((id, index) => new Word({ id, text: id, time: new TimeFragment(index, index + 0.5) })) })],
      })],
    })],
  });
}

const SHOTS = ShotPartition.fromSnapshot({
  maxShotSec: 4,
  shots: [
    { id: 'opening', startSec: 0, layers: [{ id: 'broll', mediaId: 'broll-file', inSec: 0, outSec: null, loop: false }] },
    { id: 'closing', startSec: 2 },
  ],
});

function clip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    role: 'effect',
    source: { kind: 'builtin', soundId: 'pop' },
    start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
    end: null,
    inSec: 0,
    loop: false,
    volume: 1,
    fadeInSec: 0,
    fadeOutSec: 0,
    ducking: { enabled: false, depthDb: -12 },
    ...overrides,
  };
}

function mixOf(clips: ReadonlyArray<AudioClip>, sourceVolume = 1): AudioMix {
  return clips.reduce((mix, added) => mix.withClipAdded(added), AudioMix.empty().withSourceVolume(sourceVolume));
}

function editorWith(audio: AudioMix): EditorStore {
  const store = new EditorStore();
  store.patch({
    projectId: 'project',
    projectCreatedAt: new Date('2026-10-19T00:00:00Z'),
    video: { fileName: 'talk.mp4', mimeType: 'video/mp4', size: 10, duration: 4 },
    document: documentOf(['hello', 'there']),
    shots: SHOTS,
    audio,
  });
  return store;
}

function projectOf(store: EditorStore): Project {
  return new ProjectFromEditorStateBuilder().build(store.snapshot())!;
}

async function reloaded(project: Project): Promise<Project> {
  return serializer.deserialize(JSON.parse(JSON.stringify(serializer.serialize(project))), null);
}

function clipIdsOf(audio: AudioMix): string[] {
  return audio.clips().map((held) => held.id);
}

describe('saving and loading the soundtrack', () => {
  it('brings back every clip and the video\'s own level as they were', async () => {
    const audio = mixOf([
      clip('on-word', {
        start: { anchor: { kind: 'word', wordId: 'there', edge: 'end' }, offsetSec: -0.25 },
        end: { anchor: { kind: 'shot', shotId: 'closing', edge: 'end' }, offsetSec: 0.5 },
        volume: 0.7,
      }),
      clip('music', {
        role: 'music',
        source: { kind: 'media', mediaId: 'song' },
        end: { anchor: { kind: 'video', edge: 'end' }, offsetSec: 0 },
        inSec: 12,
        loop: true,
        fadeInSec: 1,
        fadeOutSec: 2,
        ducking: { enabled: true, depthDb: -18 },
      }),
      clip('on-layer', { start: { anchor: { kind: 'layer', layerId: 'broll', edge: 'exit' }, offsetSec: 0 } }),
    ], 0.4);

    const loaded = await reloaded(projectOf(editorWith(audio)));

    expect(loaded.audio.toSnapshot()).toEqual(audio.toSnapshot());
  });

  it('stores nothing for the empty mix, and reads its absence as the empty mix', async () => {
    const project = projectOf(editorWith(AudioMix.empty()));

    expect(serializer.serialize(project)).not.toHaveProperty('audio');
    expect((await reloaded(project)).audio.isPristine()).toBe(true);
  });

  it("brings back the layers heard and the shots' video levels, and drops those naming what is gone", async () => {
    const audio = AudioMix.empty()
      .withFootageSound(['broll'], 0.6)
      .withFootageSound(['deleted-layer'], 1)
      .withShotVideoVolume(['closing', 'deleted-shot'], 0.3);

    const loaded = await reloaded(projectOf(editorWith(audio)));

    expect(loaded.audio.footageSounds()).toEqual([{ layerId: 'broll', volume: 0.6 }]);
    expect([...loaded.audio.shotVideoVolumes()]).toEqual([['closing', 0.3]]);
  });

  it('stores a project at schema version 39', () => {
    expect(serializer.serialize(projectOf(editorWith(AudioMix.empty()))).version).toBe(39);
    expect(PROJECT_SCHEMA_VERSION).toBe(39);
  });
});

describe('a project of another version', () => {
  it('opens a v24 project with the empty mix', async () => {
    const { audio: _audio, ...stored } = serializer.serialize(projectOf(editorWith(mixOf([clip('pop')]))));

    const loaded = await serializer.deserialize({ ...stored, version: 24 }, null);

    expect(loaded.audio.isPristine()).toBe(true);
  });

  it('refuses a project newer than this build rather than dropping what it does not know', async () => {
    const stored = serializer.serialize(projectOf(editorWith(mixOf([clip('pop')]))));

    await expect(serializer.deserialize({ ...stored, version: PROJECT_SCHEMA_VERSION + 1 }, null)).rejects.toThrow(/newer than supported/);
  });
});

describe('what is pruned on save', () => {
  it('drops a clip whose start word is gone from the Original track', async () => {
    const audio = mixOf([
      clip('kept', { start: { anchor: { kind: 'word', wordId: 'hello', edge: 'start' }, offsetSec: 0 } }),
      clip('detached', { start: { anchor: { kind: 'word', wordId: 'deleted', edge: 'start' }, offsetSec: 0 } }),
    ]);

    expect(clipIdsOf((await reloaded(projectOf(editorWith(audio)))).audio)).toEqual(['kept']);
  });

  it('drops a clip whose start shot or layer is gone', async () => {
    const audio = mixOf([
      clip('shot-kept', { start: { anchor: { kind: 'shot', shotId: 'closing', edge: 'start' }, offsetSec: 0 } }),
      clip('shot-gone', { start: { anchor: { kind: 'shot', shotId: 'joined', edge: 'start' }, offsetSec: 0 } }),
      clip('layer-kept', { start: { anchor: { kind: 'layer', layerId: 'broll', edge: 'entry' }, offsetSec: 0 } }),
      clip('layer-gone', { start: { anchor: { kind: 'layer', layerId: 'removed', edge: 'entry' }, offsetSec: 0 } }),
    ]);

    expect(clipIdsOf((await reloaded(projectOf(editorWith(audio)))).audio)).toEqual(['shot-kept', 'layer-kept']);
  });

  it('drops a clip on a transition that is gone, and keeps one on a transition still there', async () => {
    const store = editorWith(mixOf([
      clip('transition-kept', { start: { anchor: { kind: 'transition', shotId: 'closing' }, offsetSec: -0.1 } }),
      clip('transition-gone', { start: { anchor: { kind: 'transition', shotId: 'opening' }, offsetSec: 0 } }),
    ]));
    store.patch({ shots: SHOTS.withTransition('closing', { kind: 'whip', durationSec: 0.4 }) });

    expect(clipIdsOf((await reloaded(projectOf(store))).audio)).toEqual(['transition-kept']);
  });

  it('drops a clip on a camera that is gone, and keeps one on a camera still there', async () => {
    const store = editorWith(mixOf([
      clip('camera-kept', { start: { anchor: { kind: 'camera', shotId: 'closing' }, offsetSec: -0.07 } }),
      clip('camera-gone', { start: { anchor: { kind: 'camera', shotId: 'opening' }, offsetSec: 0 } }),
    ]));
    const zoomIn = { presetId: 'layer-zoom-in-camera', params: {} };
    store.patch({ shots: SHOTS.withLayerStyles(ElementStyles.empty().withAnimation(ShotVideoLayerId.of('closing'), 'layer', ElementAnimationScope.CAMERA, zoomIn, '')) });

    expect(clipIdsOf((await reloaded(projectOf(store))).audio)).toEqual(['camera-kept']);
  });

  it('drops a clip on an emoji removed or no longer on a word, and keeps one on an emoji the captions do not show', async () => {
    const store = editorWith(mixOf([
      clip('emoji-hidden', { start: { anchor: { kind: 'emoji', decorationId: 'on-hello' }, offsetSec: 0 } }),
      clip('emoji-removed', { start: { anchor: { kind: 'emoji', decorationId: 'on-there' }, offsetSec: 0 } }),
      clip('emoji-gone', { start: { anchor: { kind: 'emoji', decorationId: 'on-deleted' }, offsetSec: 0 } }),
    ]));
    const emojiOn = (word: Word) => word.with({ decoration: new Decoration({ id: `on-${word.id}`, glyph: '🔥' }) });
    const document = documentOf(['hello', 'there']);
    store.patch({
      document: document.with({ sections: document.sections.map((section) => section.with({ segments: section.segments.map((segment) => segment.with({
        lines: segment.lines.map((line) => line.with({ words: line.words.map(emojiOn) })),
      })) })) }),
      decorationOverrides: DecorationOverrideRegistry.empty().with('on-there', { removed: true }),
    });

    expect(clipIdsOf((await reloaded(projectOf(store))).audio)).toEqual(['emoji-hidden']);
  });

  it('keeps a clip whose end alone is gone, end and all', async () => {
    const gone = { anchor: { kind: 'word', wordId: 'deleted', edge: 'end' }, offsetSec: 0 } as const;
    const audio = mixOf([clip('end-gone', { end: gone })]);

    expect((await reloaded(projectOf(editorWith(audio)))).audio.clip('end-gone')?.end).toEqual(gone);
  });

  it('reads the Original track\'s words while a translation is active', async () => {
    const store = editorWith(mixOf([
      clip('original-word', { start: { anchor: { kind: 'word', wordId: 'hello', edge: 'start' }, offsetSec: 0 } }),
    ]));
    const original = store.snapshot().captionTracks[0]!;
    store.addCaptionTrack(new CaptionTrack({
      ...original,
      id: 'translation',
      name: 'Español',
      kind: 'translation',
      sourceTrackId: original.id,
      document: documentOf(['hola', 'ahí']),
    }));

    expect(clipIdsOf((await reloaded(projectOf(store))).audio)).toEqual(['original-word']);
  });

  it('leaves the clip in memory, where an undo can still bring its anchor back', () => {
    const store = editorWith(mixOf([
      clip('detached', { start: { anchor: { kind: 'word', wordId: 'deleted', edge: 'start' }, offsetSec: 0 } }),
    ]));

    serializer.serialize(projectOf(store));

    expect(clipIdsOf(store.snapshot().audio)).toEqual(['detached']);
  });
});

describe('the media files a project uses', () => {
  it('include the files its soundtrack plays beside those its shots show', () => {
    const project = projectOf(editorWith(mixOf([
      clip('music', { source: { kind: 'media', mediaId: 'song' } }),
      clip('pop'),
    ])));

    expect([...project.mediaIdsInUse()].sort()).toEqual(['broll-file', 'song']);
  });
});

describe('where the video changes picture', () => {
  function editorSeeing(pictureChangesSec: ReadonlyArray<number> | null): EditorStore {
    const store = editorWith(AudioMix.empty());
    store.patchVideo({ pictureChangesSec });
    return store;
  }

  it('comes back as it was saved, so a reload proposes the same shots', async () => {
    const loaded = await reloaded(projectOf(editorSeeing([1.2, 3.04])));

    expect(loaded.pictureChangesSec).toEqual([1.2, 3.04]);
  });

  it('stays unknown where nobody looked, apart from a video seen to hold none', async () => {
    expect((await reloaded(projectOf(editorSeeing(null)))).pictureChangesSec).toBeNull();
    expect((await reloaded(projectOf(editorSeeing([])))).pictureChangesSec).toEqual([]);
  });

  it('reads a damaged list as the times it still holds, in order', async () => {
    const stored = { ...serializer.serialize(projectOf(editorSeeing(null))), pictureChanges: [3, 'x', -1, 1, null] };

    expect((await serializer.deserialize(stored, null)).pictureChangesSec).toEqual([1, 3]);
  });

  it('opens a v28 project as one nobody looked at', async () => {
    const stored = { ...serializer.serialize(projectOf(editorSeeing(null))), version: 28 };

    expect((await serializer.deserialize(stored, null)).pictureChangesSec).toBeNull();
  });
});

describe('the subtitle-file cue each word was read from', () => {
  function editorWithCues(cueIndexes: ReadonlyArray<number | null>): EditorStore {
    const store = editorWith(AudioMix.empty());
    const words = cueIndexes.map((cueIndex, index) => new Word({ id: `w${index}`, text: `w${index}`, time: new TimeFragment(index, index + 0.5), cueIndex }));
    store.patch({ document: new Document({ sections: [new Section({ kind: 'main', segments: [new Segment({ lines: [new Line({ words })] })] })] }) });
    return store;
  }

  function cueIndexesOf(project: Project): Array<number | null> {
    return (project.document?.getWords() ?? []).map((word) => word.cueIndex);
  }

  it('comes back as it was saved, including words that came from no cue', async () => {
    expect(cueIndexesOf(await reloaded(projectOf(editorWithCues([0, 0, null, 1]))))).toEqual([0, 0, null, 1]);
  });

  it('reads as none in a v33 project', async () => {
    const stored = { ...serializer.serialize(projectOf(editorWith(AudioMix.empty()))), version: 33 };

    expect(cueIndexesOf(await serializer.deserialize(stored, null))).toEqual([null, null]);
  });
});

describe("the person's review notes", () => {
  function editorWithNotes(): EditorStore {
    const store = editorWith(AudioMix.empty());
    const add = new AddReviewNoteAction(store);
    add.execute({
      sourceSec: 1.25,
      place: {
        at: { x: 0.4, y: 0.7 },
        frameAspect: 9 / 16,
        marks: [{ kind: 'stroke', points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.7 }] }, { kind: 'stroke', points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.25 }] }],
      },
      refs: [{ kind: 'word', id: 'hello' }, { kind: 'shot', id: 'opening' }],
      quote: 'hello there',
      text: 'Make this bigger',
    });
    new SubmitReviewBatchAction(store, new ReviewBatchChannel()).execute();
    add.execute({ sourceSec: 3, place: null, refs: [], quote: null, text: 'Cut this pause' });
    return store;
  }

  it('come back as they were saved, sent and draft alike', async () => {
    const saved = projectOf(editorWithNotes());

    const loaded = await reloaded(saved);

    expect(loaded.reviewNotes.list()).toEqual(saved.reviewNotes.list());
    expect(loaded.reviewNotes.list().map((note) => note.status)).toEqual(['sent', 'draft']);
  });

  it('store nothing when there are none, and read their absence as none', async () => {
    const stored = serializer.serialize(projectOf(editorWith(AudioMix.empty())));

    expect(stored).not.toHaveProperty('reviewNotes');
    expect((await serializer.deserialize(stored, null)).reviewNotes.isEmpty()).toBe(true);
  });

  it('read as none in a v37 project', async () => {
    const { reviewNotes: _notes, ...stored } = serializer.serialize(projectOf(editorWithNotes()));

    const loaded = await serializer.deserialize({ ...stored, version: 37 }, null);

    expect(loaded.reviewNotes.isEmpty()).toBe(true);
  });

  it('leave out a note that cannot be read whole, and keep the others with what of them can be read', async () => {
    const stored = serializer.serialize(projectOf(editorWithNotes()));
    const [first, second] = stored.reviewNotes!;
    const damaged = [
      { ...first, refs: [...first!.refs, { kind: 'galaxy', id: 'x' }], place: { ...first!.place, marks: [{ kind: 'spiral' }] } },
      { ...second, sourceSec: 'soon' },
    ];

    const loaded = await serializer.deserialize({ ...stored, reviewNotes: damaged }, null);

    expect(loaded.reviewNotes.list().map((note) => note.number)).toEqual([1]);
    expect(loaded.reviewNotes.list()[0]!.refs).toEqual([{ kind: 'word', id: 'hello' }, { kind: 'shot', id: 'opening' }]);
    expect(loaded.reviewNotes.list()[0]!.place!.marks).toEqual([]);
  });
});
