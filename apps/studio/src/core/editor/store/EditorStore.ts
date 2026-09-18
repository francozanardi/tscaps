import type { Document } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { VideoLayout, VideoLoadError, VideoState } from '@core/editor/domain/VideoState';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { DEFAULT_TRANSCRIBE_PREFERENCE, type TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import { UndoRedoStack } from '@core/editor/store/UndoRedoStack';
import { CaptionTrack, ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';

interface UndoableSnapshot {
  readonly document: Document | null;
  readonly sheets: Sheet[];
  readonly activeSheetId: string | null;
  readonly behindActorOverrides: BehindActorSegmentOverrideRegistry;
  readonly frozenSegments: FrozenSegmentSet;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;
  readonly cuts: CutRegistry;
  readonly captionTracks: ReadonlyArray<CaptionTrack>;
  readonly activeCaptionTrackId: string | null;
}

export type EditorStatePatch =
  Omit<Partial<EditorState>, 'video'> & { video?: Partial<VideoState> };

export class EditorStore extends EventTarget {
  private _state: EditorState;

  private readonly _history = new UndoRedoStack<UndoableSnapshot>();

  constructor(initialPreference: TranscribePreference = DEFAULT_TRANSCRIBE_PREFERENCE) {
    super();
    this._state = {
      video: {
        file: null,
        url: null,
        preview: null,
        fileName: null,
        mimeType: null,
        size: null,
        layout: null,
        isReady: false,
        loadError: null,
        currentTime: 0,
        duration: 0,
        isProbing: false,
        hasAudioTrack: null,
        isSourceReadable: null,
        volume: 1,
        playbackRate: 1,
        isPlaying: false,
      },
      document: null,
      captionTracks: [],
      activeCaptionTrackId: null,
      availableTemplates: [],
      status: 'idle',
      error: null,
      transcribePreference: initialPreference,
      sheets: [],
      activeSheetId: null,
      behindActorOverrides: BehindActorSegmentOverrideRegistry.empty(),
      frozenSegments: FrozenSegmentSet.empty(),
      elementStyles: ElementStyles.empty(),
      decorationOverrides: DecorationOverrideRegistry.empty(),
      cuts: CutRegistry.empty(),
      canUndo: false,
      canRedo: false,
      projectId: null,
      projectName: 'Untitled',
      projectCreatedAt: null,
      projectThumbnail: null,
      dirty: false,
    };
  }

  snapshot(): EditorState {
    return this._state;
  }

  patch(partial: EditorStatePatch): void {
    const { video, ...rest } = partial;
    const merged: EditorState = {
      ...this._state,
      ...rest,
      ...(video ? { video: { ...this._state.video, ...video } as VideoState } : {}),
    };
    const exclusionsSynced = this.withDerivedExclusionsSynced(this._state, merged);
    this._state = this.withCaptionTracksSynced(this._state, exclusionsSynced, partial);
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Hands the reflow exclusions the segments that currently carry a
   * style of their own, so one that was cleared stops excluding its
   * segment. Structural edits are recorded on the exclusions themselves
   * and need no pass.
   */
  private withDerivedExclusionsSynced(previous: EditorState, next: EditorState): EditorState {
    if (next.elementStyles === previous.elementStyles) return next;
    const frozenSegments = next.frozenSegments.replacingStyled(next.elementStyles.segmentIds());
    return frozenSegments === next.frozenSegments ? next : { ...next, frozenSegments };
  }

  /**
   * Flags the current state as having unsaved edits. Idempotent — emits
   * a change event only on the false → true transition so subscribers
   * do not see spurious renders for every keystroke.
   */
  markDirty(): void {
    if (this._state.dirty) return;
    this._state = { ...this._state, dirty: true };
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Records that the current state has been persisted. Subsequent edits
   * flip the flag back to dirty.
   */
  markClean(): void {
    if (!this._state.dirty) return;
    this._state = { ...this._state, dirty: false };
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Resets the store to a fresh editing-session baseline: a new `main` Sheet
   * from the first available template, no document, no project identity, no
   * transient progress, and an empty undo/redo history. Preserves
   * `availableTemplates` (loaded once at startup) and user playback
   * preferences (`volume`, `playbackRate`).
   *
   * Pass `extra` to layer additional fields on top in the same mutation —
   * LoadVideoAction uses it to attach the new video file/URL atomically.
   */
  reset(extra?: EditorStatePatch): void {
    const firstTemplate = this._state.availableTemplates[0];
    const main = firstTemplate ? Sheet.createMain(firstTemplate) : null;
    this._history.clear();
    const { video: extraVideo, ...restExtra } = extra ?? {};
    const baseVideo: VideoState = {
      ...this._state.video,
      file: null,
      url: null,
      preview: null,
      fileName: null,
      mimeType: null,
      size: null,
      layout: null,
      isReady: false,
      loadError: null,
      currentTime: 0,
      duration: 0,
      isProbing: false,
      hasAudioTrack: null,
      isSourceReadable: null,
      isPlaying: false,
    };
    const cleared: EditorState = {
      ...this._state,
      // Cast keeps `Partial<VideoState>` from widening each field to `| undefined`.
      video: extraVideo ? { ...baseVideo, ...extraVideo } as VideoState : baseVideo,
      document: null,
      captionTracks: [],
      activeCaptionTrackId: null,
      status: 'idle',
      error: null,
      sheets: main ? [main] : [],
      activeSheetId: main ? MAIN_SHEET_ID : null,
      behindActorOverrides: BehindActorSegmentOverrideRegistry.empty(),
      frozenSegments: FrozenSegmentSet.empty(),
      elementStyles: ElementStyles.empty(),
      decorationOverrides: DecorationOverrideRegistry.empty(),
      cuts: CutRegistry.empty(),
      canUndo: false,
      canRedo: false,
      projectId: null,
      projectName: 'Untitled',
      projectCreatedAt: null,
      projectThumbnail: null,
      dirty: false,
      ...restExtra,
    };
    this._state = this.withDerivedExclusionsSynced(this._state, cleared);
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Returns the Sheet identified by `activeSheetId`, or null if none. Used by
   * actions whose effect targets the sheet currently shown in the StyleTab.
   */
  activeSheet(): Sheet | null {
    const { activeSheetId } = this._state;
    if (activeSheetId === null) return null;
    return this.sheet(activeSheetId);
  }

  /** Returns the Sheet with the given id, or null when it is not in the current state. */
  sheet(sheetId: string): Sheet | null {
    return this._state.sheets.find((s) => s.id === sheetId) ?? null;
  }

  /**
   * Returns a new sheets[] with the given sheet replaced (matched by id).
   * If the id is not found, returns the original array unchanged.
   */
  replaceSheet(updated: Sheet): Sheet[] {
    return this._state.sheets.map((s) => (s.id === updated.id ? updated : s));
  }

  /**
   * Pushes the current undoable state onto the history stack so the next
   * mutation can be reverted. Pass a coalesceKey to merge consecutive rapid
   * changes (e.g., slider drags on the same field) into a single history
   * entry. Updates `canUndo`/`canRedo` silently — the caller is expected to
   * follow up with a `patch()`, which dispatches the change event with the
   * fresh flags already in place.
   */
  commit(coalesceKey?: string): void {
    this._history.push(this._captureUndoable(), coalesceKey);
    this._state = {
      ...this._state,
      canUndo: this._history.canUndo(),
      canRedo: this._history.canRedo(),
      dirty: true,
    };
  }

  undo(): boolean {
    const prev = this._history.undo(this._captureUndoable());
    if (!prev) return false;
    this.patch({
      ...prev,
      canUndo: this._history.canUndo(),
      canRedo: this._history.canRedo(),
      dirty: true,
    });
    return true;
  }

  redo(): boolean {
    const next = this._history.redo(this._captureUndoable());
    if (!next) return false;
    this.patch({
      ...next,
      canUndo: this._history.canUndo(),
      canRedo: this._history.canRedo(),
      dirty: true,
    });
    return true;
  }

  /**
   * Patches the nested `video` slice and emits a change event. Used by
   * actions and the VideoController to mutate playback / load fields
   * without spreading the whole object themselves.
   */
  patchVideo(partial: Partial<VideoState>): void {
    this.patch({ video: { ...this._state.video, ...partial } });
  }

  /**
   * Updates `video.currentTime` and fires `timechange` (not `change`).
   * The snapshot exposes the fresh value immediately, but consumers
   * subscribed to `change` are not woken up — playback ticks at
   * frame rate should not invalidate the whole editor state.
   */
  setCurrentTime(time: number): void {
    if (this._state.video.currentTime === time) return;
    this._state = {
      ...this._state,
      video: { ...this._state.video, currentTime: time },
    };
    this.dispatchEvent(new Event('timechange'));
  }

  setDuration(duration: number): void {
    this.patchVideo({ duration });
  }

  setIsProbing(isProbing: boolean): void {
    if (this._state.video.isProbing === isProbing) return;
    this.patchVideo({ isProbing });
  }

  setHasAudioTrack(hasAudioTrack: boolean | null): void {
    if (this._state.video.hasAudioTrack === hasAudioTrack) return;
    this.patchVideo({ hasAudioTrack });
  }

  setIsSourceReadable(isSourceReadable: boolean | null): void {
    if (this._state.video.isSourceReadable === isSourceReadable) return;
    this.patchVideo({ isSourceReadable });
  }

  setIsPlaying(playing: boolean): void {
    this.patchVideo({ isPlaying: playing });
  }

  setVolume(vol: number): void {
    this.patchVideo({ volume: vol });
  }

  setPlaybackRate(rate: number): void {
    this.patchVideo({ playbackRate: rate });
  }

  setVideoLayout(layout: VideoLayout): void {
    this.patchVideo({ layout });
  }

  setIsVideoReady(ready: boolean): void {
    this.patchVideo({ isReady: ready });
  }

  setVideoLoadError(error: VideoLoadError | null): void {
    this.patchVideo({ loadError: error });
  }

  /**
   * Applies several `video` fields in a single mutation and emits one
   * `'change'` event. Use when one observation triggers updates to
   * many `VideoState` fields at once (e.g. the preview surface's
   * snapshot publish loop) so listeners do not see N intermediate
   * states. `currentTime` lives on its own `'timechange'` channel —
   * pass it through {@link setCurrentTime} instead.
   */
  patchVideoState(patch: Partial<VideoState>): void {
    this.patchVideo(patch);
  }

  setTranscribePreference(pref: TranscribePreference): void {
    this.patch({ transcribePreference: pref });
  }

  /** Adds a fully assembled translation and makes it the active track. */
  addCaptionTrack(track: CaptionTrack): void {
    if (this._state.captionTracks.some((candidate) => candidate.id === track.id)) return;
    this._state = {
      ...this._state,
      captionTracks: [...this._state.captionTracks, track],
      activeCaptionTrackId: track.id,
      ...this.trackProjection(track),
      dirty: true,
    };
    this.dispatchEvent(new Event('change'));
  }

  /** Switches which caption document and Studio-owned styling state actions edit. */
  setActiveCaptionTrack(trackId: string): void {
    const track = this._state.captionTracks.find((candidate) => candidate.id === trackId);
    if (!track || track.id === this._state.activeCaptionTrackId) return;
    this._state = {
      ...this._state,
      activeCaptionTrackId: track.id,
      ...this.trackProjection(track),
    };
    this.dispatchEvent(new Event('change'));
  }

  private _captureUndoable(): UndoableSnapshot {
    const s = this._state;
    return {
      document: s.document,
      sheets: s.sheets,
      activeSheetId: s.activeSheetId,
      behindActorOverrides: s.behindActorOverrides,
      frozenSegments: s.frozenSegments,
      elementStyles: s.elementStyles,
      decorationOverrides: s.decorationOverrides,
      cuts: s.cuts,
      captionTracks: s.captionTracks,
      activeCaptionTrackId: s.activeCaptionTrackId,
    };
  }

  private withCaptionTracksSynced(
    previous: EditorState,
    next: EditorState,
    patch: EditorStatePatch,
  ): EditorState {
    if (next.document === null) {
      return next.captionTracks.length === 0
        ? next
        : { ...next, captionTracks: [], activeCaptionTrackId: null };
    }
    if (next.captionTracks.length === 0) {
      const original = this.trackFromState(
        ORIGINAL_CAPTION_TRACK_ID,
        'Original',
        'original',
        null,
        next,
      );
      return {
        ...next,
        captionTracks: [original],
        activeCaptionTrackId: original.id,
      };
    }
    if (patch.captionTracks !== undefined || next.activeCaptionTrackId === null) return next;
    if (!this.trackScopedStateChanged(previous, next)) return next;
    return {
      ...next,
      captionTracks: next.captionTracks.map((track) =>
        track.id === next.activeCaptionTrackId
          ? this.trackFromState(track.id, track.name, track.kind, track.sourceTrackId, next)
          : track,
      ),
    };
  }

  private trackFromState(
    id: string,
    name: string,
    kind: CaptionTrack['kind'],
    sourceTrackId: string | null,
    state: EditorState,
  ): CaptionTrack {
    return new CaptionTrack({
      id,
      name,
      kind,
      sourceTrackId,
      document: state.document!,
      sheets: state.sheets,
      activeSheetId: state.activeSheetId,
      behindActorOverrides: state.behindActorOverrides,
      frozenSegments: state.frozenSegments,
      elementStyles: state.elementStyles,
      decorationOverrides: state.decorationOverrides,
    });
  }

  private trackProjection(track: CaptionTrack): Pick<
    EditorState,
    'document' | 'sheets' | 'activeSheetId' | 'behindActorOverrides' |
    'frozenSegments' | 'elementStyles' | 'decorationOverrides'
  > {
    return {
      document: track.document,
      sheets: [...track.sheets],
      activeSheetId: track.activeSheetId,
      behindActorOverrides: track.behindActorOverrides,
      frozenSegments: track.frozenSegments,
      elementStyles: track.elementStyles,
      decorationOverrides: track.decorationOverrides,
    };
  }

  private trackScopedStateChanged(previous: EditorState, next: EditorState): boolean {
    return previous.document !== next.document
      || previous.sheets !== next.sheets
      || previous.activeSheetId !== next.activeSheetId
      || previous.behindActorOverrides !== next.behindActorOverrides
      || previous.frozenSegments !== next.frozenSegments
      || previous.elementStyles !== next.elementStyles
      || previous.decorationOverrides !== next.decorationOverrides;
  }

}
