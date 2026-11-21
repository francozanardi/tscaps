import type { Document } from '@tscaps/engine';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { VideoLayout, VideoLoadError, VideoState } from '@core/editor/domain/VideoState';
import { Sheet, MAIN_SHEET_ID } from '@core/sheets/domain/Sheet';
import { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';
import { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { SegmentVisibilityOverrideRegistry } from '@core/captions/domain/SegmentVisibilityOverrideRegistry';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import { OutputFrame } from '@core/output-frame/domain/OutputFrame';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import { DEFAULT_TRANSCRIBE_PREFERENCE, type TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import { CheckpointHistory } from '@core/editor/store/CheckpointHistory';
import type { HistoryAuthor, HistoryTimeline } from '@core/editor/domain/HistoryCheckpoint';
import type { HistoryGroup } from '@core/editor/domain/HistoryGroup';
import type { HistoryGroupAuthorReader } from '@core/editor/domain/HistoryGroupAuthorReader';
import { ReviewNoteSet } from '@core/review-notes/domain/ReviewNoteSet';
import { CaptionTrack, ORIGINAL_CAPTION_TRACK_ID } from '@core/translations/domain/CaptionTrack';

interface UndoableSnapshot {
  readonly document: Document | null;
  readonly sheets: Sheet[];
  readonly activeSheetId: string | null;
  readonly behindActorOverrides: BehindActorOverrideRegistry;
  readonly frozenSegments: FrozenSegmentSet;
  readonly elementStyles: ElementStyles;
  readonly decorationOverrides: DecorationOverrideRegistry;
  readonly segmentVisibilityOverrides: SegmentVisibilityOverrideRegistry;
  readonly hideBriefScenes: boolean;
  readonly cuts: CutRegistry;
  readonly shots: ShotPartition;
  readonly outputFrame: OutputFrame;
  readonly audio: AudioMix;
  readonly colorGrade: ColorGrade;
  readonly captionTracks: ReadonlyArray<CaptionTrack>;
  readonly activeCaptionTrackId: string | null;
  readonly reviewNotes: ReviewNoteSet;
}

export type EditorStatePatch =
  Omit<Partial<EditorState>, 'video'> & { video?: Partial<VideoState> };

const HISTORY_START_TITLE = 'Start';

export class EditorStore extends EventTarget implements HistoryGroupAuthorReader {
  private _state: EditorState;

  private readonly _history: CheckpointHistory<UndoableSnapshot>;

  private _historyGroup: HistoryGroup | null = null;

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
        sourceUnavailable: null,
        currentTime: 0,
        duration: 0,
        isProbing: false,
        hasAudioTrack: null,
        isSourceReadable: null,
        pictureChangesSec: null,
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
      behindActorOverrides: BehindActorOverrideRegistry.empty(),
      frozenSegments: FrozenSegmentSet.empty(),
      elementStyles: ElementStyles.empty(),
      decorationOverrides: DecorationOverrideRegistry.empty(),
      segmentVisibilityOverrides: SegmentVisibilityOverrideRegistry.empty(),
      hideBriefScenes: true,
      cuts: CutRegistry.empty(),
      shots: ShotPartition.empty(),
      outputFrame: OutputFrame.original(),
      colorGrade: ColorGrade.neutral(),
      frameLayout: null,
      audio: AudioMix.empty(),
      canUndo: false,
      canRedo: false,
      projectId: null,
      projectName: 'Untitled',
      projectCreatedAt: null,
      projectThumbnail: null,
      reviewNotes: ReviewNoteSet.empty(),
      dirty: false,
    };
    this._history = new CheckpointHistory(this._captureUndoable(), HISTORY_START_TITLE);
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
    const tracksSynced = this.withCaptionTracksSynced(this._state, exclusionsSynced, partial);
    this._state = this.withFrameLayoutSynced(tracksSynced);
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

  /** Derives the output frame's size from the frame and the video's size, keeping the same object while it holds. */
  private withFrameLayoutSynced(next: EditorState): EditorState {
    const frameLayout = next.outputFrame.layoutFor(next.video.layout);
    const same = frameLayout === next.frameLayout
      || (frameLayout !== null && next.frameLayout !== null
        && frameLayout.width === next.frameLayout.width && frameLayout.height === next.frameLayout.height);
    return same ? next : { ...next, frameLayout };
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
   * Records that the current state has been persisted, and marks the
   * checkpoint shown now as the one saved. Subsequent edits flip the flag
   * back to dirty.
   */
  markClean(): void {
    this._history.markSaved();
    if (!this._state.dirty) {
      this.dispatchEvent(new Event('change'));
      return;
    }
    this._state = { ...this._state, dirty: false };
    this.dispatchEvent(new Event('change'));
  }

  /**
   * Puts `state` in place as it is, with nothing to undo: for a store
   * that carries on a session another store held until now.
   */
  restore(state: EditorState): void {
    this._state = { ...state, canUndo: false, canRedo: false };
    this._history.reset(this._captureUndoable(), HISTORY_START_TITLE);
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
      sourceUnavailable: null,
      currentTime: 0,
      duration: 0,
      isProbing: false,
      hasAudioTrack: null,
      isSourceReadable: null,
      pictureChangesSec: null,
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
      behindActorOverrides: BehindActorOverrideRegistry.empty(),
      frozenSegments: FrozenSegmentSet.empty(),
      elementStyles: ElementStyles.empty(),
      decorationOverrides: DecorationOverrideRegistry.empty(),
      segmentVisibilityOverrides: SegmentVisibilityOverrideRegistry.empty(),
      hideBriefScenes: true,
      cuts: CutRegistry.empty(),
      shots: ShotPartition.empty(),
      outputFrame: OutputFrame.original(),
      colorGrade: ColorGrade.neutral(),
      frameLayout: null,
      audio: AudioMix.empty(),
      canUndo: false,
      canRedo: false,
      projectId: null,
      projectName: 'Untitled',
      projectCreatedAt: null,
      projectThumbnail: null,
      reviewNotes: ReviewNoteSet.empty(),
      dirty: false,
      ...restExtra,
    };
    this._state = this.withFrameLayoutSynced(this.withDerivedExclusionsSynced(this._state, cleared));
    this._history.reset(this._captureUndoable(), HISTORY_START_TITLE);
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
   * True while the editor shows `videoFile`: it holds that file and is
   * not loading a project. A project being loaded is named in the state
   * before its video replaces the one held, so in between the state
   * mixes the two.
   */
  isShowing(videoFile: Blob): boolean {
    return this._state.video.file === videoFile && this._state.status !== 'loading-project';
  }

  /**
   * Returns a new sheets[] with the given sheet replaced (matched by id).
   * If the id is not found, returns the original array unchanged.
   */
  replaceSheet(updated: Sheet): Sheet[] {
    return this._state.sheets.map((s) => (s.id === updated.id ? updated : s));
  }

  /** The author of the history group open now (see `withHistoryGroup`), or null when none is. */
  get historyGroupAuthor(): HistoryAuthor | null {
    return this._historyGroup?.author ?? null;
  }

  /**
   * Runs `run` with every commit made until it settles folded into one
   * checkpoint of `group`'s author, keyed `group.key` in place of the
   * commit's own key. A later group under the same key extends that
   * checkpoint again, unless another commit, an undo, a redo or a jump came
   * in between: then it opens a checkpoint of its own, so an edit made
   * between two groups is never undone with them. A group opened inside
   * another runs under the outer one. Resolves or rejects as `run` does.
   */
  async withHistoryGroup<T>(group: HistoryGroup, run: () => T | Promise<T>): Promise<T> {
    if (this._historyGroup !== null) return run();
    this._historyGroup = group;
    try {
      return await run();
    } finally {
      this._historyGroup = null;
    }
  }

  /**
   * Records the change about to be made as a checkpoint of the history,
   * described as `label` (a few words in the imperative, such as "Change
   * font size"), so the next mutation can be reverted. Pass a coalesceKey
   * to merge consecutive rapid changes (e.g., slider drags on the same
   * field) into a single checkpoint. Updates `canUndo`/`canRedo` silently —
   * the caller is expected to follow up with a `patch()`, which dispatches
   * the change event with the fresh flags already in place.
   */
  commit(label: string, coalesceKey?: string): void {
    const group = this._historyGroup;
    this._history.record(this._captureUndoable(), group !== null ? { label, group } : coalesceKey === undefined ? { label } : { label, coalesceKey });
    this._state = {
      ...this._state,
      canUndo: this._history.canUndo(),
      canRedo: this._history.canRedo(),
      dirty: true,
    };
  }

  /**
   * The edit history as it is now: every checkpoint, the one shown and the
   * one saved. The same object until the history changes; every change to
   * it is followed by a change event.
   */
  history(): HistoryTimeline {
    return this._history.timeline();
  }

  /**
   * Titles every checkpoint made, or still to be made, under the group
   * `groupKey`. False, with nothing titled, when the group made no change
   * or the title is empty. Emits a change event when it titles.
   */
  titleHistoryGroup(groupKey: string, title: string): boolean {
    const titled = this._history.titleGroup(groupKey, title);
    if (titled) this.dispatchEvent(new Event('change'));
    return titled;
  }

  /**
   * Rewrites the shots now and in every checkpoint of the history, adding
   * none of its own: for a change no undo may take back, such as a
   * shot naming a media file that is deleted. Emits a change event.
   */
  reviseShots(revise: (shots: ShotPartition) => ShotPartition): void {
    this._history.reviseAll((snapshot) => ({ ...snapshot, shots: revise(snapshot.shots) }));
    this.patch({ shots: revise(this._state.shots) });
  }

  /**
   * Rewrites the soundtrack now and in every checkpoint of the history,
   * adding none of its own: for a change no undo may take back, such as a
   * clip playing a media file that is deleted. Emits a change event.
   */
  reviseAudio(revise: (audio: AudioMix) => AudioMix): void {
    this._history.reviseAll((snapshot) => ({ ...snapshot, audio: revise(snapshot.audio) }));
    this.patch({ audio: revise(this._state.audio) });
  }

  /** Goes back to the checkpoint before the one shown. False when the start is shown. */
  undo(): boolean {
    return this.show(this._history.undo(this._captureUndoable()));
  }

  /** Goes forward to the checkpoint last left from the one shown. False when there is none. */
  redo(): boolean {
    return this.show(this._history.redo(this._captureUndoable()));
  }

  /**
   * Shows the project as it stood at the checkpoint `checkpointId`, in any
   * branch, keeping every checkpoint. False when it is the one shown or
   * there is no such checkpoint.
   */
  jumpToCheckpoint(checkpointId: string): boolean {
    return this.show(this._history.jumpTo(checkpointId, this._captureUndoable()));
  }

  private show(snapshot: UndoableSnapshot | null): boolean {
    if (snapshot === null) return false;
    this.patch({
      ...snapshot,
      canUndo: this._history.canUndo(),
      canRedo: this._history.canRedo(),
      dirty: !this._history.isAtSaved(),
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
      segmentVisibilityOverrides: s.segmentVisibilityOverrides,
      hideBriefScenes: s.hideBriefScenes,
      cuts: s.cuts,
      shots: s.shots,
      outputFrame: s.outputFrame,
      audio: s.audio,
      colorGrade: s.colorGrade,
      captionTracks: s.captionTracks,
      activeCaptionTrackId: s.activeCaptionTrackId,
      reviewNotes: s.reviewNotes,
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
      segmentVisibilityOverrides: state.segmentVisibilityOverrides,
      hideBriefScenes: state.hideBriefScenes,
    });
  }

  private trackProjection(track: CaptionTrack): Pick<
    EditorState,
    'document' | 'sheets' | 'activeSheetId' | 'behindActorOverrides' |
    'frozenSegments' | 'elementStyles' | 'decorationOverrides' |
    'segmentVisibilityOverrides' | 'hideBriefScenes'
  > {
    return {
      document: track.document,
      sheets: [...track.sheets],
      activeSheetId: track.activeSheetId,
      behindActorOverrides: track.behindActorOverrides,
      frozenSegments: track.frozenSegments,
      elementStyles: track.elementStyles,
      decorationOverrides: track.decorationOverrides,
      segmentVisibilityOverrides: track.segmentVisibilityOverrides,
      hideBriefScenes: track.hideBriefScenes,
    };
  }

  private trackScopedStateChanged(previous: EditorState, next: EditorState): boolean {
    return previous.document !== next.document
      || previous.sheets !== next.sheets
      || previous.activeSheetId !== next.activeSheetId
      || previous.behindActorOverrides !== next.behindActorOverrides
      || previous.frozenSegments !== next.frozenSegments
      || previous.elementStyles !== next.elementStyles
      || previous.decorationOverrides !== next.decorationOverrides
      || previous.segmentVisibilityOverrides !== next.segmentVisibilityOverrides
      || previous.hideBriefScenes !== next.hideBriefScenes;
  }

}
