import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';

// A data: URL as it sits in CSS, HTML or a field: up to the first space, quote or parenthesis.
const DATA_URL = /data:[^\s"'()]+/gi;
// Below this an inline data: URL costs less to repeat than to describe.
const LONG_DATA_URL_CHARS = 256;

/**
 * Turns editor values into the small JSON values a read answers with:
 * times to the hundredth of a second, shares to the thousandth, and
 * text with every long inline `data:` URL replaced by what it is and
 * how big (`<image, 12 KB>`), since a caller reading one learns nothing
 * the description does not say. Stateless.
 */
export class ReadoutFormatter {
  /** A time or a length in seconds, rounded to the hundredth. */
  sec(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** A share of the frame, a ratio or a level, rounded to the thousandth. */
  share(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  /** `text` with each long inline data: URL replaced by a description of it; short ones are kept. */
  text(text: string): string {
    return text.replace(DATA_URL, (url) => (url.length < LONG_DATA_URL_CHARS ? url : this.describedData(url)));
  }

  /** `text` cut to at most `maxChars` characters, an ellipsis marking where it was cut. */
  excerpt(text: string, maxChars: number): string {
    const single = text.replace(/\s+/g, ' ').trim();
    return single.length <= maxChars ? single : `${single.slice(0, Math.max(0, maxChars - 1))}…`;
  }

  /**
   * A value a field or a control holds: a number or a flag as it is,
   * text with its long data: URLs described, and a font stack as the
   * face that draws Latin text.
   */
  value(value: string | number | boolean | FontStackFaces): string | number | boolean {
    if (typeof value === 'string') return this.text(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return value.latin;
  }

  private describedData(url: string): string {
    const comma = url.indexOf(',');
    const header = comma === -1 ? '' : url.slice('data:'.length, comma);
    const payloadChars = url.length - (comma === -1 ? 'data:'.length : comma + 1);
    const bytes = header.endsWith(';base64') ? payloadChars * 0.75 : payloadChars;
    const kind = header.startsWith('image/') ? 'image' : 'data';
    return `<${kind}, ${Math.max(1, Math.round(bytes / 1024))} KB>`;
  }
}
