import type { EditorState } from '@core/editor/domain/EditorState';
import { EditorStore } from '@core/editor/store/EditorStore';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';

/**
 * One preprocessing run and the editor session it was started in.
 *
 * The session lasts in the editor while the editor shows the file the
 * run was started on (`EditorStore.isShowing`). Opening another video
 * ends that, and so does opening another project, from the moment the
 * editor starts loading it. The run can still be transcribing or
 * saving when that happens. From then on the run leaves the editor
 * alone, since it now belongs to the session the reader moved to, and
 * the session goes on in a store of the run's own, from the last state
 * it had in the editor. `store()` is where the run finishes its session
 * and what its project is saved from, wherever the session lives. A
 * session that left the editor never returns to it, even if the same
 * video is opened again later.
 *
 * The run keeps its own `progress`, and the editor's progress shows it
 * while the session is in the editor, so a run the reader left never
 * moves the progress of the run they moved to.
 *
 * `projectId` is the project the run saves, picked when the run starts
 * and fixed from then on, or `null` for a run that saves none. It names
 * the project before the project exists anywhere, so everything the run
 * sends about it (the transcription request, the creation, the saves)
 * names the same one, whatever the editor shows by then. The session
 * gets the id once the project is established in it; the editor only
 * ever shows it.
 *
 * The run itself may replace its file, with a conversion of it the
 * browser can decode: `adoptVideoFile` makes the conversion the
 * session's file, so the session carries on around it.
 *
 * A run whose pipeline failed (`markFailed`) can still be saving the
 * project it started, which then stays unfinished: the reader can start
 * the same video again meanwhile, in a run of its own.
 *
 * Watches the editor store and its own progress from construction until
 * `close()`.
 */
export class PreprocessingRun {
  /** Unique per run. Lets everything one run reports be read together. */
  readonly id: string = crypto.randomUUID();

  /** This run's progress, whichever session the editor shows. */
  readonly progress = new PreprocessingProgressStore();

  private latest: EditorState;
  private file: File;
  private failed = false;
  private storeOffEditor: EditorStore | null = null;
  private readonly sessionEndListeners: (() => void)[] = [];
  private readonly onEditorChange = (): void => this.followEditor();
  private readonly onProgressChange = (): void => this.showProgressInEditor();

  constructor(
    private readonly editor: EditorStore,
    videoFile: File,
    private readonly editorProgress: PreprocessingProgressStore,
    readonly projectId: string | null,
  ) {
    this.file = videoFile;
    this.latest = editor.snapshot();
    editor.addEventListener('change', this.onEditorChange);
    this.progress.addEventListener('change', this.onProgressChange);
    this.showProgressInEditor();
  }

  /** The file this run works on: the one it was started on, or the conversion it adopted. */
  get videoFile(): File {
    return this.file;
  }

  /** True once the run's pipeline failed, whether or not its project is still being saved. */
  get hasFailed(): boolean {
    return this.failed;
  }

  /** Records that the run's pipeline failed. */
  markFailed(): void {
    this.failed = true;
  }

  /**
   * Makes `converted` the file of this run's session, ahead of the run
   * putting it in the editor in place of the chosen one. Does nothing
   * once the session has left the editor.
   */
  adoptVideoFile(converted: File): void {
    if (!this.ownsEditor()) return;
    this.file = converted;
  }

  /** True while the editor still shows the session this run was started in. */
  ownsEditor(): boolean {
    this.followEditor();
    return this.storeOffEditor === null;
  }

  /**
   * The store that holds this run's session: the editor's while it
   * shows the session, and the run's own once the editor moved on.
   */
  store(): EditorStore {
    this.followEditor();
    return this.storeOffEditor ?? this.editor;
  }

  /** The state of this run's session, wherever it lives. */
  latestState(): EditorState {
    return this.store().snapshot();
  }

  /** Calls `listener` once when the session leaves the editor, right away if it already has. */
  onSessionEnd(listener: () => void): void {
    if (this.storeOffEditor !== null) {
      listener();
      return;
    }
    this.sessionEndListeners.push(listener);
  }

  /** Stops watching the editor and the run's progress. Idempotent. */
  close(): void {
    this.editor.removeEventListener('change', this.onEditorChange);
    this.progress.removeEventListener('change', this.onProgressChange);
  }

  private followEditor(): void {
    if (this.storeOffEditor !== null) return;
    if (!this.editor.isShowing(this.file)) {
      this.leaveEditor();
      return;
    }
    this.latest = this.editor.snapshot();
  }

  private leaveEditor(): void {
    const storeOffEditor = new EditorStore();
    storeOffEditor.restore(this.latest);
    this.storeOffEditor = storeOffEditor;
    this.editor.removeEventListener('change', this.onEditorChange);
    for (const listener of this.sessionEndListeners.splice(0)) listener();
  }

  private showProgressInEditor(): void {
    if (this.ownsEditor()) this.editorProgress.show(this.progress.status);
  }
}
