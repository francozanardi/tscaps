import { z } from 'zod';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { EditorOperation } from '@core/editor-operations/domain/EditorOperation';
import type { OperationProblem, OperationResult } from '@core/editor-operations/domain/OperationResult';
import type { CaptionElementReadout } from '@core/editor-operations/services/CaptionElementReadout';
import type { CaptionRefResolver } from '@core/editor-operations/services/CaptionRefResolver';
import type { EditorRefParser } from '@core/editor-operations/services/EditorRefParser';
import type { ElementCssReads } from '@core/editor-operations/services/ElementCssReads';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { OperationInput } from '@core/editor-operations/services/OperationInput';
import type { SheetCodePart, SheetReadout } from '@core/editor-operations/services/SheetReadout';
import type { SheetRefResolver } from '@core/editor-operations/services/SheetRefResolver';
import type { ShotLayerReadout } from '@core/editor-operations/services/ShotLayerReadout';
import type { ShotReadout } from '@core/editor-operations/services/ShotReadout';
import type { ShotRefResolver } from '@core/editor-operations/services/ShotRefResolver';
import type { SoundClipReadout } from '@core/editor-operations/services/SoundClipReadout';

/**
 * `get_element`: what one element is and the style it carries of its
 * own: a caption node, a layer, a shot, a style sheet or a sound clip.
 * Reads only.
 */
export class GetElementOperation implements EditorOperation {
  readonly name = 'get_element';
  readonly effect = 'read';
  readonly description = [
    'Read one element in full by its ref.',
    'A segment, line, word or decoration (emoji): text, startSec/endSec, sheet, the nodes around it, tags, emoji, what was set on it by hand (visibility, behindPerson), and the style it carries of its own as style {css, fields, animations (by scope: preset and params), placement, blend}.',
    'A layer: its shot, type, file (mediaId, name, length, size) or graphic (preset, document {html, css, js}, fields, params set, aspectRatio, moments, last console lines), timing in the file, placement, edge transitions and style. A shot: times, transition, layers, and its own video\'s style (camera move, framing, CSS) as videoStyle.',
    'A sheet: template, preset, typography, position, styleControls with current values and ranges, the animations it set, and cssOverride (its whole CSS once edited, else null); list_catalog templates describes templates. A sound: what it plays, where it starts and ends, and its levels.',
    'Times are seconds of the source video. Inline data: URLs of 256 characters or more are shown as <image, N KB>; writing such text back whole would put the placeholder in place of the image.',
  ].join(' ');

  private readonly input = new OperationInput({
    element: z.string().min(1).describe('The element, as a ref: segment:<id>, line:<id>, word:<id>, decoration:<id>, layer:<id>, shot:<id>, sheet:<id> or sound:<id>.'),
    include: z.array(z.enum(['css', 'filtersSvg'])).optional().describe('A sheet only: also answer its whole CSS or SVG filters as they apply now (its own once edited, else its template\'s).'),
  });

  readonly inputSchema = this.input.jsonSchema();

  constructor(
    private readonly store: EditorStore,
    private readonly parser: EditorRefParser,
    private readonly captions: CaptionRefResolver,
    private readonly shots: ShotRefResolver,
    private readonly sheets: SheetRefResolver,
    private readonly captionReadout: CaptionElementReadout,
    private readonly layerReadout: ShotLayerReadout,
    private readonly shotReadout: ShotReadout,
    private readonly sheetReadout: SheetReadout,
    private readonly soundReadout: SoundClipReadout,
    private readonly cssReads: ElementCssReads,
  ) {}

  async run(input: unknown): Promise<OperationResult> {
    const checked = this.input.check(input);
    if (!checked.ok) return this.refused(checked.problems);
    const { element, include = [] } = checked.value;
    if (include.length > 0 && !element.startsWith('sheet:')) return this.refusedFor(element, '`include` reads a sheet\'s code: give a sheet:<id>.');
    const ref = this.parser.parse(element);
    if (ref === null) {
      return this.refusedFor(element, `"${element}" is not a ref; refs look like kind:id, kind one of segment, line, word, decoration, layer, shot, sheet, sound.`);
    }
    switch (ref.kind) {
      case 'segment':
      case 'line':
      case 'word':
      case 'decoration':
        return this.captionElement(element);
      case 'layer':
        return this.layerElement(element);
      case 'shot':
        return this.shotElement(element);
      case 'sheet':
        return this.sheetElement(element, include);
      case 'sound':
        return this.soundElement(element, ref.id);
    }
  }

  private captionElement(element: string): OperationResult {
    const resolved = this.captions.resolve(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    const detail = this.captionReadout.detail(resolved.value, this.store.snapshot());
    if (detail === null) return this.refusedFor(element, `${element} is not in the captions any more; read the transcript again for current refs.`);
    this.cssReads.markRead({ holder: 'caption', id: resolved.value.id });
    return this.answered(detail);
  }

  private layerElement(element: string): OperationResult {
    const resolved = this.shots.resolveLayer(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    this.cssReads.markRead({ holder: 'layer', id: resolved.value.layer.id });
    return this.answered(this.layerReadout.detail(resolved.value, this.store.snapshot()));
  }

  private shotElement(element: string): OperationResult {
    const resolved = this.shots.resolveShot(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    this.cssReads.markRead({ holder: 'layer', id: ShotVideoLayerId.of(resolved.value.shot.id) });
    return this.answered(this.shotReadout.detail(resolved.value, this.store.snapshot()));
  }

  private sheetElement(element: string, include: ReadonlyArray<SheetCodePart>): OperationResult {
    const resolved = this.sheets.resolve(element);
    if (!resolved.ok) return this.refused([resolved.problem]);
    return this.answered({ ...this.sheetReadout.detail(resolved.value, this.store.snapshot()), ...this.sheetReadout.codeOf(resolved.value, include) });
  }

  private soundElement(element: string, clipId: string): OperationResult {
    const state = this.store.snapshot();
    const clip = state.audio.clip(clipId);
    return clip === null
      ? this.refusedFor(element, `${element} is not a clip of the soundtrack; get_project lists the sound refs.`)
      : this.answered(this.soundReadout.detail(clip, state));
  }

  private answered(output: unknown): OperationResult {
    return { ok: true, output, problems: [] };
  }

  private refusedFor(element: string, message: string): OperationResult {
    return this.refused([{ severity: 'error', message, ref: element }]);
  }

  private refused(problems: ReadonlyArray<OperationProblem>): OperationResult {
    return { ok: false, output: null, problems };
  }
}
