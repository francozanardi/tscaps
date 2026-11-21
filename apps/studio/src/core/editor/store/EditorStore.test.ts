import { describe, expect, it } from 'vitest';
import { Document, Section } from '@tscaps/engine';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';
import { CaptionTrack, ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';
import { EditorStore } from '@core/editor/store/EditorStore';

function documentWithSection(id: string): Document {
  return new Document({ sections: [new Section({ id, kind: id, segments: [] })] });
}

function translation(id: string, document: Document): CaptionTrack {
  return new CaptionTrack({
    id,
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

describe('EditorStore caption tracks', () => {
  it('projects exactly one active version into the editor state', () => {
    const store = new EditorStore();
    const originalDocument = documentWithSection('original-section');
    const translatedDocument = documentWithSection('translated-section');

    store.patch({ document: originalDocument });
    expect(store.snapshot().captionTracks.map((track) => track.id)).toEqual([ORIGINAL_CAPTION_TRACK_ID]);

    store.addCaptionTrack(translation('translation-es', translatedDocument));
    expect(store.snapshot().document).toBe(translatedDocument);
    expect(store.snapshot().activeCaptionTrackId).toBe('translation-es');

    const editedTranslation = documentWithSection('translated-edited');
    store.patch({ document: editedTranslation });
    store.setActiveCaptionTrack(ORIGINAL_CAPTION_TRACK_ID);
    expect(store.snapshot().document).toBe(originalDocument);
    expect(store.snapshot().activeCaptionTrackId).toBe(ORIGINAL_CAPTION_TRACK_ID);

    store.setActiveCaptionTrack('translation-es');
    expect(store.snapshot().document).toBe(editedTranslation);
    expect(store.snapshot().activeCaptionTrackId).toBe('translation-es');
  });

  it('clears track state when the document is cleared', () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('original-section') });

    store.patch({ document: null });

    expect(store.snapshot().captionTracks).toEqual([]);
    expect(store.snapshot().activeCaptionTrackId).toBeNull();
  });
});

describe('EditorStore showing a video', () => {
  it('shows the video it holds, and no other', () => {
    const store = new EditorStore();
    const first = new File(['first'], 'first.mp4', { type: 'video/mp4' });
    const second = new File(['second'], 'second.mp4', { type: 'video/mp4' });
    store.reset({ video: { file: first } });

    store.reset({ video: { file: second } });

    expect(store.isShowing(first)).toBe(false);
    expect(store.isShowing(second)).toBe(true);
  });

  it('stops showing a video once another project starts loading', () => {
    const store = new EditorStore();
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    store.reset({ video: { file: video } });
    store.patch({ projectId: 'project-1' });

    store.patch({ status: 'loading-project' });

    expect(store.isShowing(video)).toBe(false);
  });
});

const AGENT_TURN = { key: 'turn-1', author: 'assistant' } as const;

function sectionId(store: EditorStore): string | undefined {
  return store.snapshot().document?.sections[0]?.id;
}

function edit(store: EditorStore, label: string, id: string): void {
  store.commit(label);
  store.patch({ document: documentWithSection(id) });
}

describe('EditorStore history groups', () => {
  function editTwice(store: EditorStore, firstId: string, secondId: string): void {
    store.commit('First', `first:${firstId}`);
    store.patch({ document: documentWithSection(firstId) });
    store.commit('Second', `second:${secondId}`);
    store.patch({ document: documentWithSection(secondId) });
  }

  it('undoes every change made in a group as one step', async () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('before') });

    await store.withHistoryGroup(AGENT_TURN, () => editTwice(store, 'middle', 'after'));
    await store.withHistoryGroup(AGENT_TURN, async () => {
      store.commit('Third', 'third');
      store.patch({ document: documentWithSection('last') });
    });

    expect(store.undo()).toBe(true);
    expect(sectionId(store)).toBe('before');
    expect(store.snapshot().canUndo).toBe(false);
  });

  it('keeps an edit made between two groups of the same key a step of its own', async () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('before') });

    await store.withHistoryGroup(AGENT_TURN, () => edit(store, 'Agent', 'agent-1'));
    edit(store, 'Person', 'person');
    await store.withHistoryGroup(AGENT_TURN, () => edit(store, 'Agent', 'agent-2'));

    store.undo();
    expect(sectionId(store)).toBe('person');
    store.undo();
    expect(sectionId(store)).toBe('agent-1');
    store.undo();
    expect(sectionId(store)).toBe('before');
  });

  it('goes back to the commit keys of its own once the group settles, even when it fails', async () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('before') });

    await expect(store.withHistoryGroup(AGENT_TURN, () => {
      edit(store, 'Agent', 'agent');
      throw new Error('tool failed');
    })).rejects.toThrow('tool failed');
    edit(store, 'Person', 'person');

    store.undo();
    expect(sectionId(store)).toBe('agent');
  });

  it('describes a group as one checkpoint by its author, listing each kind of edit, under the title given', async () => {
    const store = new EditorStore();
    await store.withHistoryGroup(AGENT_TURN, () => editTwice(store, 'middle', 'after'));
    store.titleHistoryGroup(AGENT_TURN.key, 'Bigger captions');

    const [start, turn] = store.history().checkpoints;
    expect(start?.parentId).toBeNull();
    expect(turn).toMatchObject({ title: 'Bigger captions', author: 'assistant', changes: ['First', 'Second'], groupKey: 'turn-1' });
  });
});

describe('EditorStore checkpoints', () => {
  it('titles an untitled checkpoint of several kinds of edit by its first, with how many more', async () => {
    const store = new EditorStore();
    await store.withHistoryGroup(AGENT_TURN, () => {
      edit(store, 'Change color look', 'a');
      edit(store, 'Change typography', 'b');
      edit(store, 'Add cut', 'c');
      edit(store, 'Change typography', 'd');
    });
    expect(store.history().checkpoints[1]).toMatchObject({
      title: 'Change color look + 2 more',
      changes: ['Change color look', 'Change typography', 'Add cut'],
    });
  });

  it('keeps the changes undone as a branch when an edit is made after going back, and can go to either', () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('start') });
    edit(store, 'Edit A', 'a');
    edit(store, 'Edit B', 'b');
    const bId = store.history().headId;

    store.undo();
    edit(store, 'Edit C', 'c');
    expect(store.history().checkpoints.map((checkpoint) => checkpoint.title)).toEqual(['Start', 'Edit A', 'Edit B', 'Edit C']);

    expect(store.jumpToCheckpoint(bId)).toBe(true);
    expect(sectionId(store)).toBe('b');
    store.undo();
    expect(sectionId(store)).toBe('a');
    store.redo();
    expect(sectionId(store)).toBe('b');
  });

  it('redoes toward the checkpoint it jumped back from', () => {
    const store = new EditorStore();
    store.patch({ document: documentWithSection('start') });
    edit(store, 'Edit A', 'a');
    edit(store, 'Edit B', 'b');
    const startId = store.history().checkpoints[0]!.id;

    store.jumpToCheckpoint(startId);
    expect(sectionId(store)).toBe('start');
    store.redo();
    store.redo();
    expect(sectionId(store)).toBe('b');
    expect(store.snapshot().canRedo).toBe(false);
  });

  it('keeps a change made without a checkpoint of its own in the checkpoint shown when it was made', () => {
    const store = new EditorStore();
    edit(store, 'Edit A', 'a');
    store.patch({ document: documentWithSection('a-tweaked') });
    edit(store, 'Edit B', 'b');

    store.undo();
    expect(sectionId(store)).toBe('a-tweaked');
  });

  it('is clean again back at the checkpoint saved, and does not fold an edit made after saving into it', () => {
    const store = new EditorStore();
    store.commit('Change style', 'style');
    store.patch({ document: documentWithSection('saved') });
    store.markClean();
    store.commit('Change style', 'style');
    store.patch({ document: documentWithSection('after-save') });

    store.undo();
    expect(sectionId(store)).toBe('saved');
    expect(store.snapshot().dirty).toBe(false);
    expect(store.history().savedId).toBe(store.history().headId);
  });

  it('starts over with only the start once reset', () => {
    const store = new EditorStore();
    edit(store, 'Edit A', 'a');
    store.reset();
    expect(store.history().checkpoints).toHaveLength(1);
    expect(store.snapshot().canUndo).toBe(false);
  });
});
