import { ApplyStructureEditAction } from '@core/captions/actions/segments/ApplyStructureEditAction';
import { DeleteWordsAction } from '@core/captions/actions/words/DeleteWordsAction';
import { CaptionsTextEditTelemetryReporter } from '@core/captions/services/CaptionsTextEditTelemetryReporter';
import { RelocatedWordClamp } from '@core/captions/services/RelocatedWordClamp';
import { SegmentHardTime } from '@core/captions/services/SegmentHardTime';
import { SegmentTimeBounds } from '@core/captions/services/SegmentTimeBounds';
import { WordTimeBounds } from '@core/captions/services/WordTimeBounds';
import { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import { CreateSpeakerSheetAction } from '@core/sheets/actions/CreateSpeakerSheetAction';
import { SheetCreationOptionFinder } from '@core/sheets/services/SheetCreationOptionFinder';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { SceneRefsReader } from '@core/editor-operations/services/SceneRefsReader';
import { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import { CaptionOperationsTestProject } from '@core/editor-operations/testing/CaptionOperationsTestProject';
import { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import { SelectedSegmentSheetMatcher } from '@core/sheet-matchers/services/SelectedSegmentSheetMatcher';
import { AssignSelectedSegmentsSheetAction } from '@core/sheets/actions/AssignSelectedSegmentsSheetAction';
import { CreateSheetAction } from '@core/sheets/actions/CreateSheetAction';
import { DeleteSheetAction } from '@core/sheets/actions/DeleteSheetAction';
import { LinkSheetAction } from '@core/sheets/actions/LinkSheetAction';
import { RenameSheetAction } from '@core/sheets/actions/RenameSheetAction';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { SetHookScenesAction } from '@core/sheets/actions/SetHookScenesAction';
import { UnlinkSheetAction } from '@core/sheets/actions/UnlinkSheetAction';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import { RoleSheetProvisioner } from '@core/sheets/services/RoleSheetProvisioner';
import { RoleTemplatePicker } from '@core/sheets/services/RoleTemplatePicker';
import { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';

const NO_TELEMETRY: Telemetry = { capture: () => {} };

/**
 * The caption and sheet operations' collaborators, real, over the caption
 * test project: `main` (active) holds scenes `s1` ("Hello world": `w1`,
 * `w2`) and `s2` ("Again here": `w3`, `w4`), `other` holds `s3` ("Bye":
 * `w5`).
 */
export class SheetOperationsFixture {
  readonly project = new CaptionOperationsTestProject();
  readonly store: EditorStore;
  readonly parser = new EditorRefParser();
  readonly reflow = new CaptionReflowDetector();
  readonly sheetRefs: SheetRefResolver;
  readonly sceneRefs: SceneRefsReader;
  readonly actions;
  readonly sheetCreationOptions: SheetCreationOptionFinder;

  constructor() {
    const template = this.project.template({
      id: 'plain',
      lineSplitter: { type: 'isolated-word', minLetters: 4, minSecondsOnScreen: 0.8 },
      effects: [
        { type: 'emoji', enabled: false, placement: 'segment-below', size: 1.8, gap: 0.1 },
        { type: 'smart_lowercase', enabled: false },
        { type: 'remove_punctuation', enabled: false },
      ],
    });
    this.store = this.project.store([this.project.sheet('main', template), this.project.sheet('other', template)]);
    this.store.patch({ availableTemplates: [template], video: { ...this.store.snapshot().video, layout: { width: 1080, height: 1920 } } });
    this.sheetRefs = new SheetRefResolver(this.store, this.parser);
    this.sceneRefs = new SceneRefsReader(new CaptionRefResolver(this.store, this.parser));
    const refresh = this.project.inertRefresh();
    const sync = new LinkedSheetsSync(new LinkedSheetsPropagationNotifier());
    const deriver = this.project.deriverFor(this.store);
    const runMatcher = new RunSheetMatcherAction(this.store, deriver);
    this.actions = {
      create: new CreateSheetAction(this.store, new SheetColorPalette(), NO_TELEMETRY),
      setActive: new SetActiveSheetAction(this.store),
      assignScenes: new AssignSelectedSegmentsSheetAction(runMatcher, new SelectedSegmentSheetMatcher()),
      setHookScenes: new SetHookScenesAction(this.store, refresh, new RoleSheetProvisioner(new RoleTemplatePicker()), NO_TELEMETRY),
      rename: new RenameSheetAction(this.store),
      link: new LinkSheetAction(this.store, refresh, sync),
      unlink: new UnlinkSheetAction(this.store),
      delete: new DeleteSheetAction(this.store, refresh),
      createSpeaker: new CreateSpeakerSheetAction(this.store, refresh, new SheetColorPalette(), sync, runMatcher, new SpeakerSheetMatcher(), NO_TELEMETRY),
      applyStructureEdit: new ApplyStructureEditAction(this.store, deriver, new RelocatedWordClamp(new WordTimeBounds(), new SegmentTimeBounds(new SegmentHardTime())), new CaptionsTextEditTelemetryReporter(NO_TELEMETRY, this.store)),
      deleteWords: new DeleteWordsAction(this.store, deriver, new CaptionsTextEditTelemetryReporter(NO_TELEMETRY, this.store)),
    };
    this.sheetCreationOptions = new SheetCreationOptionFinder(new SpeakerSheetMatcher());
  }

  /** Says which speaker said each word: `speakers` maps word ids to speaker ids. */
  attributeSpeakers(speakers: Readonly<Record<string, string>>): void {
    const document = this.store.snapshot().document;
    if (document === null) return;
    this.store.patch({
      document: document.with({
        sections: document.sections.map((section) => section.with({
          segments: section.segments.map((segment) => segment.with({
            lines: segment.lines.map((line) => line.with({
              words: line.words.map((word) => word.with({ speakerId: speakers[word.id] ?? null })),
            })),
          })),
        })),
      }),
    });
  }

  /**
   * The id of the sheet holding word `wordId`, or null when no scene has
   * it. Asked by word, since a scene that moves is laid out again under a
   * new id while its words keep theirs.
   */
  sheetOfWord(wordId: string): string | null {
    const section = this.store.snapshot().document?.sections.find((candidate) => candidate.getWords().some((word) => word.id === wordId));
    return section?.kind ?? null;
  }
}
