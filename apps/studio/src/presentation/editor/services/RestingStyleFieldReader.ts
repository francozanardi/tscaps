import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementField } from '@core/elements/domain/fields/ElementField';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { RestingElementStyle } from '@presentation/editor/services/RestingElementStyle';

const COMPUTED_RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
// What a browser computes for a colour mixed in sRGB, `color-mix()` among
// them: channels from 0 to 1, and an opacity after a slash when below 1.
const COMPUTED_SRGB = /^color\(srgb\s+(-?[\d.]+(?:e-?\d+)?)\s+(-?[\d.]+(?:e-?\d+)?)\s+(-?[\d.]+(?:e-?\d+)?)\s*(?:\/\s*([\d.]+(?:e-?\d+)?)\s*)?\)$/;
const COMPUTED_NUMBER = /^(-?\d*\.?\d+(?:e-?\d+)?)([a-z%]*)$/i;

/** A colour as sRGB channels, each from 0 to 255, and its opacity, from 0 to 1. */
interface SrgbColor {
  readonly channels: readonly [number, number, number];
  readonly alpha: number;
}

/** An angle unit, and what one of it is worth in degrees. */
interface AngleUnit {
  readonly unit: string;
  readonly degrees: number;
}

const ANGLE_UNITS: ReadonlyArray<AngleUnit> = [
  { unit: 'deg', degrees: 1 },
  { unit: 'grad', degrees: 0.9 },
  { unit: 'rad', degrees: 180 / Math.PI },
  { unit: 'turn', degrees: 360 },
];

/**
 * Turns what a browser computed for a word at rest into the values its
 * fields hold.
 *
 * Goes by each field's own control — the property it writes on a word,
 * its type, its unit and its options — and nothing else, so a field
 * added tomorrow is collected and read with no change here. A computed
 * value no answer of the control's would have written reads as
 * `undefined`, and so does every font: what a font field holds is a
 * stack, and a computed list of families cannot be turned back into one.
 * So does a fully transparent colour, which is what a word painted by
 * other means computes to and not a colour anyone sees on it.
 */
export class RestingStyleFieldReader {
  /** The properties `fields` write on a word: what has to be collected for {@link read} to answer them. */
  propertiesFor(fields: ReadonlyArray<ElementField>): string[] {
    return [...new Set(fields.map((field) => field.controlFor('text').property))];
  }

  /** The value `control` would hold for a word resolved to `style`. */
  read(control: AuthoredElementControl, style: RestingElementStyle): ElementControlValue | undefined {
    const computed = style.valueOf(control.property);
    if (computed === '') return undefined;
    if (control.part === 'keyword') return this.keyword(control, computed);
    if (control.part !== 'whole') return undefined;
    switch (control.type) {
      case 'number': return this.number(control, computed, style.parentValueOf(control.property));
      case 'color': return this.hexColor(computed);
      case 'select':
      case 'toggle': return this.option(control, computed);
      case 'font': return undefined;
    }
  }

  // The second option is the token the control owns; the first is what
  // the property says without it.
  private keyword(control: AuthoredElementControl, computed: string): string | undefined {
    const [off, on] = control.options ?? [];
    if (off === undefined || on === undefined) return undefined;
    return computed.split(/\s+/).includes(on.value) ? on.value : off.value;
  }

  private number(control: AuthoredElementControl, computed: string, parentComputed: string): number | undefined {
    const unit = control.unit ?? '';
    if (unit === '%') return this.shareOfParent(computed, parentComputed);
    if (unit === 'deg') return this.degrees(computed);
    const match = COMPUTED_NUMBER.exec(computed);
    return match && match[2] === unit ? Number(match[1]) : undefined;
  }

  // A percentage is the word's share of the same property on the line it
  // sits in, which the browser computes to two absolute lengths.
  private shareOfParent(computed: string, parentComputed: string): number | undefined {
    const own = parseFloat(computed);
    const parent = parseFloat(parentComputed);
    if (!Number.isFinite(own) || !Number.isFinite(parent) || parent <= 0) return undefined;
    return Math.round((own / parent) * 100);
  }

  // A turn the browser leaves at `none` is no turn at all.
  private degrees(computed: string): number | undefined {
    if (computed === 'none') return 0;
    const match = COMPUTED_NUMBER.exec(computed);
    const angle = ANGLE_UNITS.find((candidate) => candidate.unit === match?.[2]);
    if (!match || angle === undefined) return undefined;
    return Math.round(Number(match[1]) * angle.degrees * 100) / 100;
  }

  // Opaque colours as `#rrggbb` and translucent ones as `#rrggbbaa`, the
  // two forms the colour picker takes. A colour nobody sees reads as
  // nothing: a template that draws its letters another way, with a
  // gradient clipped to them, leaves `color` transparent, and a picker
  // opened on it would hold an opacity of zero that every pick keeps.
  private hexColor(computed: string): string | undefined {
    const color = this.legacyRgb(computed) ?? this.srgbFunction(computed);
    if (color === null || color.alpha === 0) return undefined;
    const bytes = color.channels.map((channel) => this.hexByte(channel));
    if (color.alpha < 1) bytes.push(this.hexByte(color.alpha * 255));
    return `#${bytes.join('')}`;
  }

  private legacyRgb(computed: string): SrgbColor | null {
    const match = COMPUTED_RGB.exec(computed);
    if (!match) return null;
    return {
      channels: [Number(match[1]), Number(match[2]), Number(match[3])],
      alpha: match[4] === undefined ? 1 : Number(match[4]),
    };
  }

  // A channel outside 0–1 is a colour sRGB cannot hold, so no hex can
  // stand for it.
  private srgbFunction(computed: string): SrgbColor | null {
    const match = COMPUTED_SRGB.exec(computed);
    if (!match) return null;
    const channels = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
    if (channels.some((channel) => channel < 0 || channel > 1)) return null;
    return {
      channels: [channels[0] * 255, channels[1] * 255, channels[2] * 255],
      alpha: match[4] === undefined ? 1 : Number(match[4]),
    };
  }

  private hexByte(value: number): string {
    return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  }

  private option(control: AuthoredElementControl, computed: string): string | undefined {
    return control.options?.some((option) => option.value === computed) ? computed : undefined;
  }
}
