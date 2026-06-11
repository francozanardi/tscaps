import type { Document } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { VideoLayout, VideoLoadError, VideoState } from '@core/editor/domain/VideoState';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import { DEFAULT_TRANSCRIBE_PREFERENCE, type TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import { UndoRedoStack } from '@core/editor/store/UndoRedoStack';

interface UndoableSnapshot {
  readonly document: Document | null;
  readonly sheets: Sheet[];
  readonly activeSheetId: string | null;
  readonly wordStyleOverrides: WordStyleOverrideRegistry;
  readonly segmentOverrides: SegmentOverrides;
}

export type EditorStatePatch =
  Omit<Partial<EditorState>, 'video'> & { video?: Partial<VideoState> };

export class EditorStore extends EventTarget {
  private _state: EditorState;

  private readonly _changeEvent = new Event('change');
  private readonly _timeChangeEvent = new Event('timechange');
  private readonly _history = new UndoRedoStack<UndoableSnapshot>();

  constructor(initialPreference: TranscribePreference = DEFAULT_TRANSCRIBE_PREFERENCE) {
    super();
    this._state = {
      video: {
        file: null,
        url: null,
        layout: null,
        isReady: false,
        loadError: null,
        currentTime: 0,
        duration: 0,
        volume: 1,
        playbackRate: 1,
        isPlaying: false,
      },
      document: null,
      availableTemplates: [],
      status: 'idle',
      error: null,
      transcribePreference: initialPreference,
      sheets: [],
      activeSheetId: null,
      wordStyleOverrides: WordStyleOverrideRegistry.empty(),
      segmentOverrides: SegmentOverrides.empty(),
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
    this._state = {
      ...this._state,
      ...rest,
      ...(video ? { video: { ...this._state.video, ...video } as VideoState } : {}),
    };
    this.dispatchEvent(this._changeEvent);
  }

  /**
   * Flags the current state as having unsaved edits. Idempotent — emits
   * a change event only on the false → true transition so subscribers
   * do not see spurious renders for every keystroke.
   */
  markDirty(): void {
    if (this._state.dirty) return;
    this._state = { ...this._state, dirty: true };
    this.dispatchEvent(this._changeEvent);
  }

  /**
   * Records that the current state has been persisted. Subsequent edits
   * flip the flag back to dirty.
   */
  markClean(): void {
    if (!this._state.dirty) return;
    this._state = { ...this._state, dirty: false };
    this.dispatchEvent(this._changeEvent);
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
      layout: null,
      isReady: false,
      loadError: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
    };
    this._state = {
      ...this._state,
      // Cast keeps `Partial<VideoState>` from widening each field to `| undefined`.
      video: extraVideo ? { ...baseVideo, ...extraVideo } as VideoState : baseVideo,
      document: null,
      status: 'idle',
      error: null,
      sheets: main ? [main] : [],
      activeSheetId: main ? MAIN_SHEET_ID : null,
      wordStyleOverrides: WordStyleOverrideRegistry.empty(),
      segmentOverrides: SegmentOverrides.empty(),
      canUndo: false,
      canRedo: false,
      projectId: null,
      projectName: 'Untitled',
      projectCreatedAt: null,
      projectThumbnail: null,
      dirty: false,
      ...restExtra,
    };
    this.dispatchEvent(this._changeEvent);
  }

  /**
   * Returns the Sheet identified by `activeSheetId`, or null if none. Used by
   * actions whose effect targets the sheet currently shown in the StyleTab.
   */
  activeSheet(): Sheet | null {
    const { sheets, activeSheetId } = this._state;
    if (activeSheetId === null) return null;
    return sheets.find((s) => s.id === activeSheetId) ?? null;
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
    this.dispatchEvent(this._timeChangeEvent);
  }

  setDuration(duration: number): void {
    this.patchVideo({ duration });
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

  setTranscribePreference(pref: TranscribePreference): void {
    this.patch({ transcribePreference: pref });
  }

  private _captureUndoable(): UndoableSnapshot {
    const s = this._state;
    return {
      document: s.document,
      sheets: s.sheets,
      activeSheetId: s.activeSheetId,
      wordStyleOverrides: s.wordStyleOverrides,
      segmentOverrides: s.segmentOverrides,
    };
  }
}
