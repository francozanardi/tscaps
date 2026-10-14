import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { StartBehindActorAnalysisAction } from '@core/person-segmentation/actions/StartBehindActorAnalysisAction';
import type { CaptionedRangeCollector } from '@core/person-segmentation/services/CaptionedRangeCollector';
import type { PersonSegmentationResultReader } from '@core/person-segmentation/services/PersonSegmentationResultReader';
import type { BehindActorPreviewSupportChecker } from '@core/person-segmentation/services/BehindActorPreviewSupportChecker';
import type { PersonSegmentationFlowStore } from '@core/person-segmentation/store/PersonSegmentationFlowStore';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorOverrideRegistry } from '@core/person-segmentation/domain/BehindActorOverrideRegistry';

interface RevertSnapshot {
  readonly sheets: Sheet[];
  readonly activeSheetId: string | null;
  readonly elementStyles: ElementStyles;
  readonly behindActorOverrides: BehindActorOverrideRegistry;
}

/**
 * Kicks the actor-cutout analysis off for the loaded project, once
 * per project, whenever an active sheet's template starts requiring
 * the effect. The kick-off takes one of two shapes, chosen from what
 * the user was doing at the moment:
 *
 * - The user swapped the template on the current active sheet — an
 *   explicit choice. The dialog opens to ask, and a cancel reverts the
 *   swap so the choice is undone rather than left half-applied.
 * - Any other cause — the template was already picked when the project
 *   loaded, or the active sheet switched onto a behind-actor sheet on
 *   its own. There is nothing to revert, so a cancel would only leave
 *   the template stuck without the analysis it needs. The analysis
 *   starts silently instead, and the playback gate covers what it has
 *   not reached yet.
 *
 * Either way the offer is a one-shot opt-in: once the analyzer has
 * been told to work, nothing here asks or starts again. Two signals
 * carry that decision. This session's acceptance flag stands for
 * "the analyzer is on it right now", surviving the head start's own
 * pending publish. Any `analyzedRanges` on the persisted record stands
 * for "a run happened at some point", surviving a reload. Mask
 * backfills leave `analyzedRanges` empty, so they never count.
 *
 * Coverage of the current captions is not the gate. Re-checking it
 * would reopen the dialog every time the active sheet flips across a
 * section boundary while the drain is still in flight, which is the
 * case reported as "the dialog reopens as I play forward".
 */
export class PersonSegmentationTriggerAutomation {
  private lastEvaluatedTemplateId: string | null = null;
  private lastEvaluatedActiveSheetId: string | null = null;
  private lastEvaluatedSnapshot: RevertSnapshot | null = null;
  private pendingRevert: RevertSnapshot | null = null;
  private readonly acceptedProjectIds = new Set<string>();
  private acceptedInMemory = false;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly captionedRanges: CaptionedRangeCollector,
    private readonly resultReader: PersonSegmentationResultReader,
    private readonly startAnalysis: StartBehindActorAnalysisAction,
    private readonly flowStore: PersonSegmentationFlowStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly previewSupportChecker: BehindActorPreviewSupportChecker,
  ) {}

  start(): void {
    this.editorStore.addEventListener('change', this.onStoreChange);
    void this.evaluate();
  }

  stop(): void {
    this.editorStore.removeEventListener('change', this.onStoreChange);
  }

  /**
   * Restores the sheets, elementStyles and behindActorOverrides that
   * were live before the template swap that opened the last confirm.
   * No-op when the dialog was opened by anything other than a swap on
   * the current active sheet.
   */
  revertPending(): void {
    const revert = this.pendingRevert;
    this.pendingRevert = null;
    if (revert === null) return;
    this.editorStore.patch({
      sheets: revert.sheets,
      activeSheetId: revert.activeSheetId,
      elementStyles: revert.elementStyles,
      behindActorOverrides: revert.behindActorOverrides,
    });
    this.refresh.execute();
  }

  /**
   * Notes that the user has opted into scanning for the loaded project
   * and drops the pending revert. Called after the scan starts. The
   * note lives for the session; the persisted signal is that a run
   * left `analyzedRanges` on the record, which future evaluations
   * check as well.
   */
  noteAcceptance(): void {
    this.pendingRevert = null;
    const projectId = this.editorStore.snapshot().projectId;
    if (projectId === null) this.acceptedInMemory = true;
    else this.acceptedProjectIds.add(projectId);
  }

  private readonly onStoreChange = (): void => {
    void this.evaluate();
  };

  private async evaluate(): Promise<void> {
    const snap = this.editorStore.snapshot();
    const activeSheet = this.editorStore.activeSheet();
    const templateId = activeSheet?.template.metadata.id ?? null;
    const activeSheetId = snap.activeSheetId;

    const templateChanged = templateId !== this.lastEvaluatedTemplateId;
    const activeSheetChanged = activeSheetId !== this.lastEvaluatedActiveSheetId;
    if (!templateChanged && !activeSheetChanged) return;

    // A dialog already up owns the pending revert; do not disturb it.
    if (this.flowStore.status.mode !== 'closed') {
      this.rememberSnapshot(snap);
      this.lastEvaluatedTemplateId = templateId;
      this.lastEvaluatedActiveSheetId = activeSheetId;
      return;
    }

    const isTemplateSwapOnSameActiveSheet =
      !activeSheetChanged && templateChanged && activeSheetId !== null;
    const previousSnapshot = this.lastEvaluatedSnapshot;

    this.lastEvaluatedTemplateId = templateId;
    this.lastEvaluatedActiveSheetId = activeSheetId;
    this.rememberSnapshot(snap);

    if (activeSheet === null) return;
    if (!activeSheet.template.behindActor.required) return;
    // A session playing the original has no canvas to composite on, so
    // the scan would spend minutes decoding for an effect that cannot
    // paint. The gallery already hides these templates; this covers
    // whatever route still arrives with one applied.
    if (!this.previewSupportChecker.isSupported()) return;

    // Nothing on screen means nothing the effect could composite, so
    // there is no scan to offer and no gap to report.
    if (this.captionedRanges.collect(snap.document, snap.sheets).isEmpty()) return;

    if (await this.userAlreadyOptedIn(snap.projectId)) return;

    if (isTemplateSwapOnSameActiveSheet) {
      this.askBeforeScanning(previousSnapshot);
      return;
    }
    this.startScanningSilently();
  }

  /**
   * Opens the confirm dialog and remembers the state to fall back to
   * if the user cancels. Reached when the user actively picked the
   * behind-actor template on the current active sheet, which is the
   * only path where a cancel has something to revert.
   */
  private askBeforeScanning(previousSnapshot: RevertSnapshot | null): void {
    this.pendingRevert = previousSnapshot;
    this.flowStore.openConfirm();
  }

  /**
   * Starts the scan without asking. Reached when the template was
   * already in place — a saved project loading, or an active-sheet
   * switch onto a behind-actor sheet — where a cancel would only
   * leave the template stuck without the analysis it needs.
   *
   * Acceptance is noted before the call so re-evaluations firing
   * during the head start's pending publish do not fire a second
   * start; the analyzer's own deduplication would swallow it, but
   * the automation should not lean on that.
   */
  private startScanningSilently(): void {
    this.noteAcceptance();
    void this.startAnalysis.execute().catch((error) => {
      console.error('[behind-actor] failed to start the scan for a template already in place', error);
    });
  }

  /**
   * Whether the user has already opted into scanning this project.
   *
   * Two independent signals answer the same question. This session's
   * acceptance flag stands for "the user just said yes and the
   * analyzer is on it", so a chunk still queued does not reopen the
   * dialog while the drain is running — the reported failure mode.
   * Any `analyzedRanges` on the persisted result stands for "a run
   * happened at some point", which survives a reload and covers the
   * case where the drain ran fully in a previous session. Mask
   * backfills leave `analyzedRanges` empty, so they never count.
   */
  private async userAlreadyOptedIn(projectId: string | null): Promise<boolean> {
    if (projectId === null ? this.acceptedInMemory : this.acceptedProjectIds.has(projectId)) return true;
    const known = await this.resultReader.read(projectId);
    return known !== null && !known.analyzedRanges.isEmpty();
  }

  private rememberSnapshot(snap: EditorState): void {
    this.lastEvaluatedSnapshot = {
      sheets: snap.sheets,
      activeSheetId: snap.activeSheetId,
      elementStyles: snap.elementStyles,
      behindActorOverrides: snap.behindActorOverrides,
    };
  }
}
