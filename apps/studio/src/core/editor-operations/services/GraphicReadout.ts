import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicField } from '@core/graphics/domain/GraphicField';
import type { GraphicPresetCatalog } from '@core/graphics/domain/GraphicPresetCatalog';
import type { GraphicMessageLog } from '@core/graphics/store/GraphicMessageLog';
import type { ReadoutValue } from '@core/editor-operations/services/ElementStyleReadout';
import type { ReadoutFormatter } from '@core/editor-operations/services/ReadoutFormatter';

/** A field a graphic's code reads, as a read answers it. */
export interface GraphicFieldReadout {
  readonly id: string;
  readonly label: string;
  readonly kind: GraphicField['kind'];
  readonly default: ReadoutValue;
}

/** Everything a graphic holds, as a read answers it. */
export interface GraphicReadoutDetail {
  /** The preset it still is, absent once its code was edited. */
  readonly preset?: string;
  readonly document: GraphicDocument;
  readonly fields: ReadonlyArray<GraphicFieldReadout>;
  /** Only the values set; a field missing here holds its default. */
  readonly params: Readonly<Record<string, ReadoutValue>>;
  readonly aspectRatio: number;
  /** Present when the graphic keeps the captions off the screen for its whole shot. */
  readonly hidesCaptions?: true;
  /** When each declared moment happens, in seconds after the graphic comes in. */
  readonly moments?: ReadonlyArray<{ readonly id: string; readonly label: string; readonly sec: number }>;
  /** What its code logged or threw lately, oldest first, as `level: text`. */
  readonly console?: ReadonlyArray<string>;
}

// Enough of a graphic's console to see what went wrong lately, not a whole loop's worth of logging.
const CONSOLE_LINES = 10;
const NAME_TEXT_CHARS = 40;

/**
 * Reads a graphic layer's graphic for a read answer: what it is called,
 * and its document, fields, values, moments and recent console lines.
 * Long inline data: URLs in its values and its document are described
 * rather than repeated.
 */
export class GraphicReadout {
  constructor(
    private readonly presets: GraphicPresetCatalog,
    private readonly messages: GraphicMessageLog,
    private readonly format: ReadoutFormatter,
  ) {}

  /**
   * What the graphic is called: its preset's name (`Custom graphic`
   * once its code was edited), followed by the first text it shows.
   */
  nameOf(graphic: Graphic): string {
    const name = this.presets.presetOf(graphic)?.name ?? 'Custom graphic';
    const firstText = this.firstTextOf(graphic);
    return firstText === null ? name : `${name}: "${this.format.excerpt(firstText, NAME_TEXT_CHARS)}"`;
  }

  /** Everything the graphic of the layer `layerId` holds, and what its code said lately while it ran in the preview. */
  detail(layerId: string, graphic: Graphic): GraphicReadoutDetail {
    const preset = this.presets.presetOf(graphic);
    const consoleLines = this.messages.of(layerId).slice(-CONSOLE_LINES).map((message) => `${message.level}: ${message.text}`);
    return {
      ...(preset === null ? {} : { preset: preset.id }),
      document: {
        html: this.format.text(graphic.document.html),
        css: this.format.text(graphic.document.css),
        js: this.format.text(graphic.document.js),
      },
      fields: this.fieldsOf(graphic.fields),
      params: Object.fromEntries(Object.entries(graphic.params).map(([id, value]) => [id, this.format.value(value)])),
      aspectRatio: this.format.share(graphic.aspectRatio),
      ...(graphic.hidesCaptions ? { hidesCaptions: true as const } : {}),
      ...(graphic.moments.length === 0
        ? {}
        : { moments: graphic.moments.map((moment) => ({ id: moment.id, label: moment.label, sec: this.format.sec(moment.sec) })) }),
      ...(consoleLines.length === 0 ? {} : { console: consoleLines }),
    };
  }

  /** The fields a graphic's code reads, with what each holds until it is set. */
  fieldsOf(fields: ReadonlyArray<GraphicField>): GraphicFieldReadout[] {
    return fields.map((field) => ({ id: field.id, label: field.label, kind: field.kind, default: this.format.value(field.defaultValue) }));
  }

  private firstTextOf(graphic: Graphic): string | null {
    const field = graphic.fields.find((candidate) => candidate.kind === 'text');
    if (field === undefined) return null;
    const value = graphic.params[field.id] ?? field.defaultValue;
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }
}
