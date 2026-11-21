import type { OutputFrameTelemetryReporter } from '@core/output-frame/services/OutputFrameTelemetryReporter';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { OutputFrame } from '@core/output-frame/domain/OutputFrame';

/**
 * Puts the video in another output frame, or sits it differently in the
 * one it has. Captions are laid out again when the frame's size changes,
 * since their lines are broken to its width. Commits the previous state
 * so the change participates in undo/redo; a run of changes to where the
 * video sits, such as a slider drag, is one undo step. A frame equal to
 * the current one changes nothing.
 */
export class SetOutputFrameAction {
  constructor(
    private readonly store: EditorStore,
    private readonly refresh: RefreshDocumentAction,
    private readonly telemetry: OutputFrameTelemetryReporter,
  ) {}

  execute(frame: OutputFrame): void {
    const { outputFrame: current, frameLayout: layoutBefore } = this.store.snapshot();
    if (frame.equals(current)) return;
    const onlyMoved = frame.withPosition(current.position).equals(current);
    this.store.commit(onlyMoved ? 'Move video in frame' : 'Change aspect ratio', onlyMoved ? 'outputFramePosition' : undefined);
    this.store.patch({ outputFrame: frame });
    if (this.store.snapshot().frameLayout !== layoutBefore) this.refresh.execute();
    this.telemetry.changed(current, frame);
  }
}
