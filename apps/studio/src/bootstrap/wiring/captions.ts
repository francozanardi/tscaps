import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';
import { WordTagEditTelemetryReporter } from '@core/captions/services/WordTagEditTelemetryReporter';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import { EditWordTextAction } from '@core/captions/actions/words/EditWordTextAction';
import { EditWordTimeAction } from '@core/captions/actions/words/EditWordTimeAction';
import { EditWordTagsAction } from '@core/captions/actions/words/EditWordTagsAction';
import { EditSelectedWordTagAction } from '@core/captions/actions/words/EditSelectedWordTagAction';
import { DeleteWordsAction } from '@core/captions/actions/words/DeleteWordsAction';
import { InsertWordAction } from '@core/captions/actions/words/InsertWordAction';
import { AddDecorationAction } from '@core/captions/actions/decorations/AddDecorationAction';
import { SetDecorationOverrideAction } from '@core/captions/actions/decorations/SetDecorationOverrideAction';
import { ClearDecorationAction } from '@core/captions/actions/decorations/ClearDecorationAction';
import { SetSegmentBehindActorOverrideAction } from '@core/captions/actions/segments/SetSegmentBehindActorOverrideAction';
import { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import { ApplySmartSegmentEditAction } from '@core/captions/actions/segments/ApplySmartSegmentEditAction';
import { SplitSegmentAtCursorAction } from '@core/captions/actions/segments/SplitSegmentAtCursorAction';
import { MergeSegmentWithSiblingAction } from '@core/captions/actions/segments/MergeSegmentWithSiblingAction';
import { EditSegmentTimeAction } from '@core/captions/actions/segments/EditSegmentTimeAction';
import { RedistributeSegmentWordsAction } from '@core/captions/actions/segments/RedistributeSegmentWordsAction';
import { InsertSegmentAction } from '@core/captions/actions/segments/InsertSegmentAction';
import { ResetSegmentLayoutAction } from '@core/captions/actions/segments/ResetSegmentLayoutAction';
import { ResetSheetLayoutAction } from '@core/captions/actions/segments/ResetSheetLayoutAction';
import { SetSelectedSegmentsBehindActorOverrideAction } from '@core/captions/actions/segments/SetSelectedSegmentsBehindActorOverrideAction';
import { WordTimeBounds } from '@core/captions/services/WordTimeBounds';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { RelocatedWordClamp } from '@core/captions/services/RelocatedWordClamp';
import { DocumentElementDescendantResolver } from '@core/captions/services/DocumentElementDescendantResolver';
import { DocumentSheetElementResolver } from '@core/captions/services/DocumentSheetElementResolver';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';

export interface CaptionsDependencies {
  readonly store: EditorStore;
  readonly deriver: DocumentDeriver;
  readonly refresh: RefreshDocumentAction;
  readonly telemetry: TelemetryModule;
}

export type CaptionsModule = ReturnType<typeof bootCaptions>;

/**
 * Boots every action that shapes the captions output — text edits,
 * decoration management, style overrides, structure changes, layout
 * resets. These actions are dispatched from several surfaces inside
 * the Captions mode: the Transcript subtab, the Layout subtab, the
 * overlay popovers triggered by clicking on the rendered captions,
 * and the overlay manipulation controller that drives drag / resize /
 * rotate gestures. The module groups them by domain entity so each
 * dispatcher imports the same `actions.words`, `actions.decorations`,
 * `actions.segments` surface.
 */
export function bootCaptions(deps: CaptionsDependencies) {
  const { store, deriver, refresh } = deps;
  const videoDurationProvider = () => store.snapshot().video.duration;
  const textEditReporter = new CaptionsTextEditTelemetryReporter(deps.telemetry.telemetry);
  const wordTagEditReporter = new WordTagEditTelemetryReporter(deps.telemetry.telemetry);
  const wordTimeBounds = new WordTimeBounds();
  const segmentHardTime = new SegmentHardTime();
  const segmentTimeBounds = new SegmentTimeBounds(segmentHardTime);
  const relocatedWordClamp = new RelocatedWordClamp(wordTimeBounds, segmentTimeBounds);
  const cutAwareDocumentBuilder = new CutAwareDocumentBuilder();
  return {
    services: {
      wordTimeBounds,
      segmentTimeBounds,
      elementDescendantResolver: new DocumentElementDescendantResolver(store),
      sheetElementResolver: new DocumentSheetElementResolver(store),
    },
    actions: {
      words: {
        editText: new EditWordTextAction(store, deriver, textEditReporter),
        editTime: new EditWordTimeAction(store, deriver, wordTimeBounds, segmentTimeBounds),
        editTags: new EditWordTagsAction(store, deriver, wordTagEditReporter),
        editSelectedTag: new EditSelectedWordTagAction(store, deriver, wordTagEditReporter),
        delete: new DeleteWordsAction(store, deriver, textEditReporter),
        insert: new InsertWordAction(store, deriver, textEditReporter),
      },
      decorations: {
        add: new AddDecorationAction(store, deriver),
        setOverride: new SetDecorationOverrideAction(store, refresh),
        clear: new ClearDecorationAction(store, deriver),
      },
      segments: {
        setBehindActorOverride: new SetSegmentBehindActorOverrideAction(store, deps.telemetry.telemetry),
        applyStructureEdit: new ApplyStructureEditAction(store, deriver, relocatedWordClamp, textEditReporter),
        applySmartEdit: new ApplySmartSegmentEditAction(store, deriver, videoDurationProvider, textEditReporter),
        splitAtCursor: new SplitSegmentAtCursorAction(store, deriver, videoDurationProvider),
        mergeWithSibling: new MergeSegmentWithSiblingAction(store, deriver, videoDurationProvider, cutAwareDocumentBuilder),
        editTime: new EditSegmentTimeAction(store, deriver, segmentTimeBounds),
        redistributeWords: new RedistributeSegmentWordsAction(store, deriver),
        insert: new InsertSegmentAction(store, deriver, videoDurationProvider, segmentHardTime, segmentTimeBounds, cutAwareDocumentBuilder),
        resetLayout: new ResetSegmentLayoutAction(store, refresh),
        resetSheetLayout: new ResetSheetLayoutAction(store, refresh),
        setSelectedBehindActorOverride: new SetSelectedSegmentsBehindActorOverrideAction(store, deps.telemetry.telemetry),
      },
    },
  };
}
