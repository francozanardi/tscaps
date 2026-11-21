import { z } from 'zod';
import type { SetSegmentsHiddenAction } from '@core/captions/actions/segments/SetSegmentsHiddenAction';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionElement, CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

const MAX_SEGMENTS = 200;

/**
 * `set_segments_hidden`: hides scenes from the video, or shows them
 * again and keeps them shown, in one undo step. Every ref is checked
 * before anything is written. Answers the scenes whose answer changed;
 * the others already had it.
 */
export class SetSegmentsHiddenOperation implements EditorOperation {
  readonly name = 'set_segments_hidden';
  readonly effect = 'edit';
  readonly description = [
    'Hide scenes (segments) from the video, or show them again.',
    'A hidden scene keeps its words and times in the transcript but is not painted, and the captions on either side close over its time; use it to drop a caption without deleting what was said.',
    '`hidden: false` shows scenes again and keeps them shown even where the "hide brief scenes" setting would hide them, and even under a graphic that keeps the captions off its shot (a hook), which is then answered as a warning.',
    'Nothing is changed when any ref is gone.',
  ].join(' ');

  private readonly input = new OperationInput({
    segments: z.array(z.string()).min(1).max(MAX_SEGMENTS).describe('The scenes, as refs: segment:<id>.'),
    hidden: z.boolean().describe('true hides them; false shows them and keeps them shown.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly store: EditorStore,
    private readonly setSegmentsHidden: SetSegmentsHiddenAction,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { segments, hidden } = checked.value;
    const resolved = segments.map((ref) => this.captions.resolve(ref, ['segment']));
    const problems = resolved.flatMap((each) => (each.ok ? [] : [each.problem]));
    if (problems.length > 0) return this.refused(problems);
    const scenes = resolved.flatMap((each) => (each.ok ? [each.value] : []));
    const changing = this.changing(scenes, hidden);
    this.setSegmentsHidden.execute({ segmentIds: new Set(scenes.map((scene) => scene.id)), hidden });
    return { ok: true, output: { hidden, changed: changing.map((scene) => scene.ref) }, problems: hidden ? [] : this.underCaptionFreeGraphics(scenes) };
  }

  /** A warning for the scenes now shown where a graphic keeps the captions off its shot, so both are on screen. */
  private underCaptionFreeGraphics(scenes: ReadonlyArray<CaptionElement>): OperationProblem[] {
    const { shots, video } = this.store.snapshot();
    const spans = shots.captionlessSpans(video.duration);
    const under = scenes.filter((scene) => spans.some((span) => scene.startSec < span.endSec && scene.endSec > span.startSec));
    if (under.length === 0) return [];
    return [{
      severity: 'warning',
      message: `${under.map((scene) => scene.ref).join(', ')} now show under a graphic that keeps the captions off its shot (a hook), so both are on screen. To let the graphic hide them again, hide them with hidden: true.`,
    }];
  }

  /** The scenes not yet told what `hidden` says, each once. */
  private changing(scenes: ReadonlyArray<CaptionElement>, hidden: boolean): CaptionElement[] {
    const overrides = this.store.snapshot().segmentVisibilityOverrides;
    const wanted = hidden ? 'hidden' : 'shown';
    const unique = [...new Map(scenes.map((scene) => [scene.id, scene])).values()];
    return unique.filter((scene) => overrides.get(scene.id) !== wanted);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
