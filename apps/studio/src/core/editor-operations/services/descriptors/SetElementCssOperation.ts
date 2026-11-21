import { z } from 'zod';
import type { SetElementCssAction } from '@core/elements/actions/SetElementCssAction';
import type { ElementCssValidator } from '@core/elements/services/css/ElementCssValidator';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';
import type { ElementCssReads, ElementCssTarget } from '@core/editor-operations/services/ElementCssReads';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SetShotLayerCssAction } from '@core/shots/actions/SetShotLayerCssAction';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';

/**
 * `set_element_css`: replaces the CSS one element carries of its own: a
 * caption segment, line, word or emoji, a layer of a shot, or a shot's
 * own video. Answers the editor's CSS checks as warnings, so the caller
 * can fix what will not draw. Refuses to write over CSS that changed
 * since the caller last saw it, answering what it is now.
 */
export class SetElementCssOperation implements EditorOperation {
  readonly name = 'set_element_css';
  readonly effect = 'edit';
  readonly description = [
    'Replace the CSS of one element with `css` (the whole text: what it had is dropped, the blocks its animations and the declarations its fields wrote included; an empty string clears it). Read the element first (get_element): a write over CSS that changed since you last saw it is refused, and the refusal shows it.',
    'Works on caption elements (segment, line, word, decoration), on a layer (b-roll, picture, graphic box) and on a shot (its own video).',
    'Write declarations for the element itself, and nested rules for its parts (see the CSS guide). Animations must start on a playhead-anchored delay; read the animation guide first.',
    'Only url(#id) and inline data: URLs may be used. Answers warnings for CSS the editor will not draw as written.',
  ].join(' ');

  private readonly input = new OperationInput({
    element: z.string().describe('The element, as a ref: segment:<id>, line:<id>, word:<id>, decoration:<id>, layer:<id> or shot:<id>.'),
    css: z.string().max(20_000).describe('The CSS the element carries, replacing what it had.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly shots: ShotRefResolver,
    private readonly setElementCss: SetElementCssAction,
    private readonly setShotLayerCss: SetShotLayerCssAction,
    private readonly validator: ElementCssValidator,
    private readonly gate: CssWriteGate,
    private readonly reads: ElementCssReads,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { element, css } = checked.value;
    const refused = this.gate.check(css);
    if (refused.length > 0) return this.refused(refused.map((problem) => ({ ...problem, ref: element })));
    if (element.startsWith('layer:') || element.startsWith('shot:')) return this.writeOnShot(element, css);
    return this.writeOnCaption(element, css);
  }

  private writeOnCaption(element: string, css: string): OperationResult {
    const resolved = this.captions.resolve(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const { id, kind } = resolved.value;
    const target: ElementCssTarget = { holder: 'caption', id };
    const unread = this.reads.unreadChange(target);
    if (unread !== null) return this.changedSinceRead(element, target, unread);
    this.setElementCss.execute(id, kind, css);
    this.reads.markRead(target);
    return this.written(element, this.warningsFor(element, css, kind));
  }

  private writeOnShot(element: string, css: string): OperationResult {
    if (element.startsWith('shot:')) {
      const shot = this.shots.resolveShot(element);
      if (!shot.ok) return this.refused([shot.problem]);
      return this.writeOnLayer(element, ShotVideoLayerId.of(shot.value.shot.id), css);
    }
    const layer = this.shots.resolveLayer(element);
    if (!layer.ok) return this.refused([layer.problem]);
    return this.writeOnLayer(element, layer.value.layer.id, css);
  }

  private writeOnLayer(element: string, layerId: string, css: string): OperationResult {
    const target: ElementCssTarget = { holder: 'layer', id: layerId };
    const unread = this.reads.unreadChange(target);
    if (unread !== null) return this.changedSinceRead(element, target, unread);
    this.setShotLayerCss.execute(layerId, css);
    this.reads.markRead(target);
    return this.written(element, this.warningsFor(element, css, 'layer'));
  }

  /**
   * Refuses a write over CSS that was not read since it last changed, and
   * answers that CSS, which counts as reading it: the same request sent
   * again replaces it as it is.
   */
  private changedSinceRead(element: string, target: ElementCssTarget, css: string): OperationResult {
    this.reads.markRead(target);
    return {
      ok: false,
      output: { element, css },
      problems: [{
        severity: 'error',
        message: `${element}'s CSS changed since you last read or wrote it (its fields, its animations or the person may have written it, or emptied it); it is shown here as css. Nothing was written. Write your CSS again on top of it to keep it, or send the same request again to replace it as it is.`,
        ref: element,
      }],
    };
  }

  private warningsFor(element: string, css: string, kind: Parameters<ElementCssValidator['validate']>[1]): OperationProblem[] {
    return this.validator.validate(css, kind).map((problem) => ({ severity: 'warning', message: problem.message, ref: element }));
  }

  private written(element: string, warnings: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: true, output: { element, written: true }, problems: warnings };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
