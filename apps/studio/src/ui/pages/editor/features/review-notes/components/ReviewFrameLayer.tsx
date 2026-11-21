import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type PointerEvent } from 'react';
import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import type { ReviewNoteRef } from '@core/review-notes/domain/ReviewNoteRef';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';
import { CaptionQuoteReader } from '@presentation/review-notes/services/CaptionQuoteReader';
import { MarkedElementsReader } from '@presentation/review-notes/services/MarkedElementsReader';
import { ReviewFrameGestures } from '@presentation/review-notes/services/ReviewFrameGestures';
import { ReviewMarkGeometry } from '@presentation/review-notes/services/ReviewMarkGeometry';
import type { ReviewMarkingStore, ReviewTool } from '@presentation/review-notes/stores/ReviewMarkingStore';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useReviewNotes as useReviewNotesModule } from '@ui/_shared/contexts/modules/ReviewNotesContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import { ReviewBubble } from '@ui/pages/editor/features/review-notes/components/ReviewBubble';
import { ReviewMarksDrawing } from '@ui/pages/editor/features/review-notes/components/ReviewMarksDrawing';
import { ReviewNoteCard } from '@ui/pages/editor/features/review-notes/components/ReviewNoteCard';
import { ReviewNoteField } from '@ui/pages/editor/features/review-notes/components/ReviewNoteField';
import { ReviewToolStrip } from '@ui/pages/editor/features/review-notes/components/ReviewToolStrip';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useElementRect } from '@ui/pages/editor/features/review-notes/hooks/useElementRect';
import { useReviewMarking } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarking';
import { useReviewMarkingByTouch } from '@ui/pages/editor/features/review-notes/hooks/useReviewMarkingByTouch';
import { useReviewNotes, useReviewNotesShown } from '@ui/pages/editor/features/review-notes/hooks/useReviewNotes';
import { REVIEW_PIN, REVIEW_POINT_RING } from '@ui/pages/editor/features/review-notes/review-notes-classes';

const geometry = new ReviewMarkGeometry();
const markedElements = new MarkedElementsReader(geometry);
const quotes = new CaptionQuoteReader();

interface ReviewFrameLayerProps {
  store: ReviewMarkingStore;
  /** Told when a note is added, with where its pin landed on screen. */
  onNoteAdded?: ((from: DOMRect) => void) | undefined;
}

/**
 * Everything review notes draw over the frame: the notes at the
 * playhead's moment (marks and numbered pins, a pin opening its note),
 * the tools (by touch, only while offered: a press elsewhere on the
 * frame puts them away), and, while marking, a surface that takes every press for
 * drawing, what is being drawn, and the bubble the note is written in.
 * Covers the frame exactly, so its shares are the output frame's.
 */
export function ReviewFrameLayer({ store, onNoteAdded }: ReviewFrameLayerProps) {
  const editorStore = useEditorStore();
  const reviewNotes = useReviewNotesModule();
  const shots = useShots();
  const marking = useReviewMarking(store);
  const notes = useReviewNotes();
  const shown = useReviewNotesShown(notes);
  const playback = usePlayback();
  const layerRef = useRef<HTMLDivElement>(null);
  const frame = useElementRect(layerRef);
  const aspect = useFrameAspect();
  const byTouch = useReviewMarkingByTouch();
  useOpenNoteFollowsPlayhead(store, marking.openNoteId, shown);

  const pressTool = useCallback((tool: ReviewTool) => {
    const { active, tool: picked } = store.snapshot();
    if (active && picked === tool) {
      store.stop();
      return;
    }
    playback.pause();
    store.selectTool(tool);
  }, [store, playback]);

  const compose = useCallback((at: ReviewPoint, marks: ReadonlyArray<ReviewMark>) => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    if (!layer || !root) return;
    const state = editorStore.snapshot();
    const sourceSec = state.video.currentTime;
    const shot = shots.services.materializer.materializeFrom(state).at(sourceSec);
    const refs: ReviewNoteRef[] = [
      ...markedElements.read(root, layer.getBoundingClientRect(), at, marks, state.document),
      ...(shot === null ? [] : [{ kind: 'shot' as const, id: shot.id }]),
    ];
    store.compose({ sourceSec, at, marks, refs, quote: quotes.quoteAt(state.document, sourceSec) });
  }, [editorStore, shots, store]);

  const gestures = useMemo(() => new ReviewFrameGestures(store, geometry), [store]);

  const addComposed = useCallback(() => {
    const { composition } = store.snapshot();
    const layer = layerRef.current;
    if (composition === null || !layer) return;
    const note = reviewNotes.actions.add.execute({
      sourceSec: composition.sourceSec,
      place: { at: composition.at, frameAspect: aspect, marks: composition.marks },
      refs: composition.refs,
      quote: composition.quote,
      text: composition.text,
    });
    if (note === null) return;
    store.discardComposition();
    onNoteAdded?.(pinRectOf(layer.getBoundingClientRect(), composition.at));
  }, [store, reviewNotes, aspect, onNoteAdded]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !layerRef.current) return;
    event.stopPropagation();
    // No mousedown after it: a comment's field opens on this press and takes focus, and a mousedown on the layer
    // (sent after the finger lifts, on a touch screen) would take that focus back.
    event.preventDefault();
    if (gestures.press(layerRef.current.getBoundingClientRect(), event.clientX, event.clientY, compose)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (layerRef.current) gestures.move(layerRef.current.getBoundingClientRect(), event.clientX, event.clientY);
  };

  const openNote = shown.find((note) => note.id === marking.openNoteId) ?? null;
  const composing = marking.composition;
  const drawn = [
    ...shown.flatMap((note) => note.place?.marks ?? []),
    ...(composing?.marks ?? []),
    ...(marking.drawing === null ? [] : [marking.drawing]),
  ];

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 pointer-events-none" data-review-frame-layer>
      <ReviewMarksDrawing marks={drawn} aspect={aspect} />
      {marking.active && (
        <div
          className="absolute inset-0 pointer-events-auto cursor-crosshair touch-none"
          aria-label="Frame to mark"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => gestures.release(compose)}
          onPointerCancel={() => gestures.release(compose)}
          onClick={(event) => event.stopPropagation()}
        />
      )}
      {shown.map((note) => note.place !== null && note.id !== openNote?.id && (
        <NotePin key={note.id} note={note} at={note.place.at} onOpen={() => store.openNote(note.id)} />
      ))}
      {marking.choosing && (
        // A press anywhere on the frame but the tools puts them away without marking.
        <div className="absolute inset-0 pointer-events-auto" aria-hidden onPointerDown={(event) => { event.stopPropagation(); store.stop(); }} onClick={(event) => event.stopPropagation()} />
      )}
      <ReviewToolStrip tool={marking.active ? marking.tool : null} onToolPress={pressTool} byTouch={byTouch} choosing={marking.choosing} />
      {composing !== null && composing.marks.length === 0 && (
        <span className={REVIEW_POINT_RING} style={{ left: `${composing.at.x * 100}%`, top: `${composing.at.y * 100}%` }} aria-hidden />
      )}
      {composing !== null && frame !== null && (
        <ReviewBubble at={composing.at} frame={frame} label="New note">
          <ReviewNoteField
            value={composing.text}
            placeholder="What should change?"
            label="New note"
            onChange={(text) => store.setText(text)}
            onSubmit={addComposed}
            onCancel={() => store.discardComposition()}
          />
          <div className="flex items-center justify-between gap-2">
            {byTouch ? <span /> : <span className="text-2xs text-fg-faint">Enter to add</span>}
            <button type="button" className={BTN_PRIMARY_SM} onClick={addComposed} disabled={composing.text.trim() === ''}>Add note</button>
          </div>
        </ReviewBubble>
      )}
      {openNote !== null && frame !== null && (
        <ReviewNoteCard
          key={openNote.id}
          note={openNote}
          frame={frame}
          onEdit={(text) => { if (reviewNotes.actions.edit.execute(openNote.id, text)) store.closeNote(); }}
          onDelete={() => { reviewNotes.actions.delete.execute(openNote.id); store.closeNote(); }}
          onSendAgain={() => { reviewNotes.actions.reopen.execute(openNote.id); store.closeNote(); }}
          onClose={() => store.closeNote()}
        />
      )}
    </div>
  );
}

/** A note's numbered pin, which opens it, and the ring on its point when nothing was drawn. */
function NotePin({ note, at, onOpen }: { note: ReviewNote; at: ReviewPoint; onOpen: () => void }) {
  const position = { left: `${at.x * 100}%`, top: `${at.y * 100}%` };
  return (
    <>
    {note.place?.marks.length === 0 && <span className={REVIEW_POINT_RING} style={position} aria-hidden />}
    <button
      type="button"
      className={`${REVIEW_PIN} pointer-events-auto z-20 ${note.status === 'draft' ? '' : 'opacity-80'}`}
      style={position}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}
      aria-label={`Note ${note.number}: ${note.text}`}
    >
      {note.number}
    </button>
    </>
  );
}

/**
 * Closes the open note once the playhead has moved off its moment: a
 * note shows only at its own frames. A note opened from away (the
 * scrubber's dot seeks to it) is left open until it has shown once.
 */
function useOpenNoteFollowsPlayhead(store: ReviewMarkingStore, openNoteId: string | null, shown: ReadonlyArray<ReviewNote>): void {
  const seen = useRef<string | null>(null);
  const isShown = openNoteId !== null && shown.some((note) => note.id === openNoteId);
  useEffect(() => {
    if (openNoteId === null) {
      seen.current = null;
      return;
    }
    if (isShown) seen.current = openNoteId;
    else if (seen.current === openNoteId) store.closeNote();
  }, [store, openNoteId, isShown]);
}

/** A pin's size on screen, as `REVIEW_PIN` draws it. */
const PIN_PX = 24;

/** Where a new note's pin sits on screen. */
function pinRectOf(frame: DOMRect, at: ReviewPoint): DOMRect {
  return new DOMRect(frame.left + at.x * frame.width - PIN_PX / 2, frame.top + at.y * frame.height - PIN_PX / 2, PIN_PX, PIN_PX);
}

/** The output frame's width over its height; square until the frame is known. */
function useFrameAspect(): number {
  const editorStore = useEditorStore();
  const subscribe = useCallback((notify: () => void) => {
    editorStore.addEventListener('change', notify);
    return () => editorStore.removeEventListener('change', notify);
  }, [editorStore]);
  return useSyncExternalStore(subscribe, () => {
    const layout = editorStore.snapshot().frameLayout;
    return layout === null || layout.height === 0 ? 1 : layout.width / layout.height;
  });
}
