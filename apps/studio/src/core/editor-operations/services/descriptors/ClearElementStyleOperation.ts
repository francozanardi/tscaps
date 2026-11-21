import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { ResetCaptionElementAction } from '@core/elements/actions/ResetCaptionElementAction';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { CaptionReflowDetector } from '@core/editor-operations/services/CaptionReflowDetector';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

/**
 * `clear_element_style`: takes back everything one caption element was
 * styled with of its own, so it looks as its sheet's template says. A
 * scene that loses the last of its own style lets go of the layout it
 * was holding, which can re-split it with its neighbours; that comes
 * back as a warning.
 */
export class ClearElementStyleOperation implements EditorOperation {
  readonly name = 'clear_element_style';
  readonly effect = 'edit';
  readonly description = [
    'Take back everything one caption element (segment, line, word or decoration = emoji) was styled with of its own:',
    'its CSS, its fields, its animations, its blend and where it was dragged in the frame. It then looks as its sheet\'s template says.',
    'Its behind-the-person setting and the sounds placed on a word go too; its text, tags and emoji stay.',
    'A scene that loses its own style flows with its neighbours again, which can re-split them and change segment refs (answered as a warning).',
    'Layers have no clear: use set_element_css with "" and set_element_animation with null.',
  ].join(' ');

  private readonly input = new OperationInput({
    element: z.string().describe('The caption element, as a ref: segment:<id>, line:<id>, word:<id> or decoration:<id>.'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly captions: CaptionRefResolver,
    private readonly store: EditorStore,
    private readonly clearElementStyle: ResetCaptionElementAction,
    private readonly reflow: CaptionReflowDetector,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { element } = checked.value;
    if (element.startsWith('layer:') || element.startsWith('shot:')) {
      return this.refused([{
        severity: 'error',
        ref: element,
        message: 'Layers and shots have no clear: use set_element_css with "" and set_element_animation with preset null.',
      }]);
    }
    const resolved = this.captions.resolve(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const before = this.store.snapshot();
    const hadStyle = before.elementStyles.has(resolved.value.id);
    this.clearElementStyle.execute(resolved.value.id);
    const reflowed = this.reflow.warningFor(before.document, this.store.snapshot().document);
    return { ok: true, output: { element, cleared: hadStyle }, problems: reflowed === null ? [] : [reflowed] };
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
