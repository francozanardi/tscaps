import { describe, expect, it } from 'vitest';
import { Document, Section } from '@tscaps/engine';
import { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
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
    behindActorOverrides: BehindActorSegmentOverrideRegistry.empty(),
    frozenSegments: FrozenSegmentSet.empty(),
    elementStyles: ElementStyles.empty(),
    decorationOverrides: DecorationOverrideRegistry.empty(),
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
