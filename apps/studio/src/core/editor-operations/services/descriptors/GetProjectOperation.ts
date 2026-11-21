import { ColorGrade } from '@core/color-grade/domain/ColorGrade';
import type { EditorState } from '@core/editor/domain/EditorState';
import type { EditorStore } from '@core/editor/store/EditorStore';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import type { OriginalCaptionTrackReader } from '@core/translations/services/OriginalCaptionTrackReader';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';
import type { ShotReadout } from '@core/editor-operations/services/ShotReadout';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SoundClipReadout } from '@core/editor-operations/services/SoundClipReadout';

const SPEAKERS_NOT_TOLD_APART = 'The transcription did not tell the voices apart, so who says each line is not known: do not style or colour captions by speaker.';

/**
 * `get_project`: the overview a caller reads before editing: the video,
 * the caption tracks, a note where the transcription told no voices apart, the sheets, every shot with what it draws, the
 * cuts, the soundtrack's clips, the colour grade and how many elements
 * carry a style of their own. Reads only.
 */
export class GetProjectOperation implements EditorOperation {
  readonly name = 'get_project';
  readonly effect = 'read';
  readonly description = [
    'Read the overview of the open project; call it first, and again after big changes.',
    'Answers the video (length, output frame size and shape, spoken language, playhead), `speakers` only where the transcription told no voices apart (who says each line is then not known), the caption sheets (sheet refs, template, how many segments each styles), every shot in order with its transition, camera move (`cameraThrough` the last shot it runs over where that is a later one, `cameraFrom` the earlier shot whose camera and framing run over this one) and layers (layer refs, what each shows, `through` the last shot one shows on where that is a later shot, and under `continuing` the layers of earlier shots still showing on it), the cuts, the sound clips with where they start and end, the colour grade and how many elements carry a style of their own, by kind.',
    'Times are seconds of the source video, before cuts. Captions are not listed: get_transcript reads segments and words, get_element one element in full.',
  ].join(' ');

  private readonly input = new OperationInput({});

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly shots: ShotRefResolver,
    private readonly shotReadout: ShotReadout,
    private readonly sounds: SoundClipReadout,
    private readonly originalCaptions: OriginalCaptionTrackReader,
    private readonly parser: EditorRefParser,
    private readonly format: ReadoutFormatter,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const state = this.store.snapshot();
    if (state.video.duration <= 0 && state.document === null) {
      return this.refused([{ severity: 'error', message: 'No video is open in the editor yet: there is no project to read.' }]);
    }
    const captionTracks = this.captionTracksOf(state);
    const cuts = this.cutsOf(state);
    const sounds = this.sounds.rows(state);
    const colorGrade = this.colorGradeOf(state);
    const styledElements = this.styledElementsOf(state);
    return {
      ok: true,
      output: {
        video: this.videoOf(state),
        ...(captionTracks === null ? {} : { captionTracks }),
        ...(state.document === null || this.voicesToldApart(state) ? {} : { speakers: { known: [], note: SPEAKERS_NOT_TOLD_APART } }),
        sheets: this.sheetsOf(state),
        shots: this.shots.shots().map((shot) => this.shotReadout.row(shot, state)),
        ...(cuts.length === 0 ? {} : { cuts }),
        ...(sounds.length === 0 ? {} : { sounds }),
        ...(colorGrade === null ? {} : { colorGrade }),
        ...(styledElements === null ? {} : { styledElements }),
      },
      problems: [],
    };
  }

  private videoOf(state: EditorState): Record<string, unknown> {
    const { video, frameLayout, outputFrame, cuts, audio } = state;
    const language = this.originalCaptions.read(state).document?.language ?? null;
    const source = outputFrame.isOriginal() ? null : video.layout;
    return {
      durationSec: this.format.sec(video.duration),
      ...(cuts.isEmpty() ? {} : { durationAfterCutsSec: this.format.sec(Math.max(0, video.duration - cuts.totalSec())) }),
      ...(frameLayout === null ? {} : { width: frameLayout.width, height: frameLayout.height }),
      ...(outputFrame.isOriginal()
        ? {}
        : { format: outputFrame.format, fit: outputFrame.fit, ...(outputFrame.fit === 'fit' ? { backdrop: outputFrame.backdrop } : {}) }),
      ...(source === null ? {} : { source: { width: source.width, height: source.height } }),
      ...(language === null ? {} : { language }),
      ...(audio.sourceVolume === 1 ? {} : { volume: this.format.share(audio.sourceVolume) }),
      playheadSec: this.format.sec(video.currentTime),
    };
  }

  /** Every caption track, the one shown marked; null while there is only the original. */
  private captionTracksOf(state: EditorState): Array<Record<string, unknown>> | null {
    if (state.captionTracks.length < 2) return null;
    return state.captionTracks.map((track) => ({
      id: track.id,
      name: track.name,
      ...(track.document.language === null ? {} : { language: track.document.language }),
      ...(track.id === state.activeCaptionTrackId ? { active: true } : {}),
    }));
  }

  /** Whether the transcription said who speaks any word. */
  private voicesToldApart(state: EditorState): boolean {
    return (this.originalCaptions.read(state).document?.getWords() ?? []).some((word) => word.speakerId !== null);
  }

  private sheetsOf(state: EditorState): Array<Record<string, unknown>> {
    const segmentCounts = new Map<string, number>();
    for (const section of state.document?.sections ?? []) {
      segmentCounts.set(section.kind, (segmentCounts.get(section.kind) ?? 0) + section.segments.length);
    }
    return state.sheets.map((sheet) => ({
      ref: this.parser.formatOf('sheet', sheet.id),
      name: sheet.name,
      template: { id: sheet.template.metadata.id, name: sheet.template.metadata.name },
      ...(sheet.id === state.activeSheetId ? { active: true } : {}),
      ...(sheet.role === null ? {} : { role: sheet.role }),
      segments: segmentCounts.get(sheet.id) ?? 0,
    }));
  }

  private cutsOf(state: EditorState): Array<{ startSec: number; endSec: number }> {
    return state.cuts.list().map((cut) => ({ startSec: this.format.sec(cut.startSec), endSec: this.format.sec(cut.endSec) }));
  }

  /** The adjustments moved off neutral; null for a neutral grade. */
  private colorGradeOf(state: EditorState): Record<string, number> | null {
    const moved = ColorGrade.fields().filter((field) => state.colorGrade.valueOf(field) !== 0);
    return moved.length === 0
      ? null
      : Object.fromEntries(moved.map((field) => [field, this.format.share(state.colorGrade.valueOf(field))]));
  }

  /** How many elements of each kind carry a style of their own, a shot's own video counted as `shot`; null where none does. */
  private styledElementsOf(state: EditorState): Record<string, number> | null {
    const kinds = [
      ...[...state.elementStyles.all().values()].map((style) => style.kind),
      ...[...state.shots.layerStyles.elementIds()].map((id) => (ShotVideoLayerId.shotIdOf(id) === null ? 'layer' : 'shot')),
    ];
    const counts: Record<string, number> = {};
    for (const kind of kinds) counts[kind] = (counts[kind] ?? 0) + 1;
    return kinds.length === 0 ? null : counts;
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
