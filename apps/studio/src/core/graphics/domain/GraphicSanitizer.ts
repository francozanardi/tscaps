import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicField, GraphicFieldKind } from '@core/graphics/domain/GraphicField';
import type { GraphicMoment } from '@core/graphics/domain/GraphicMoment';
import type { GraphicParamValue } from '@core/graphics/domain/GraphicStage';

const FIELD_KINDS: ReadonlySet<string> = new Set<GraphicFieldKind>(['text', 'color', 'number', 'image', 'emoji']);
// An image field holds a small picture inline: a raster `data:` URL, no larger than an avatar or a logo needs.
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGE_CHARS = 400_000;
// An emoji field holds one glyph, or none; the longest joined sequences (families, flags with tags) stay under this.
const MAX_EMOJI_CHARS = 32;
// The shapes a box can take: from a tall strip to a thin bar across the frame, fifty to one either way.
const MIN_ASPECT_RATIO = 1 / 50;
const MAX_ASPECT_RATIO = 50;
const SQUARE = 1;
// A moment's id is a short name a sound can keep pointing at; its label is what the Sound tab shows.
const MOMENT_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_MOMENT_LABEL_CHARS = 60;
const MAX_MOMENTS = 20;

/**
 * The one place a graphic is checked, for what is read back from storage
 * and for what an edit writes alike.
 */
export class GraphicSanitizer {
  /**
   * `value` as a graphic that can be trusted, or null where it holds no
   * document. A part of the document that is not text is empty; a field
   * naming no id, or one already named, is dropped, and so is a value no
   * field reads, whose type is not a field's, or an image that is not a
   * raster `data:` URL of at most 400 000 characters; a shape that is not a
   * positive number is square, and one out of range is clamped. A moment
   * whose id is not a short name (letters, digits, `-`, `_`), or already
   * named, or whose time is not a number of seconds from zero, is dropped;
   * a moment without a label is called by its id. At most 20 are kept, in
   * the order they happen.
   */
  sanitize(value: unknown): Graphic | null {
    const raw = this.recordOf(value);
    const document = raw === null ? null : this.recordOf(raw['document']);
    if (raw === null || document === null) return null;
    const fields = this.fieldsOf(raw['fields']);
    return {
      document: { html: this.textOf(document['html']), css: this.textOf(document['css']), js: this.textOf(document['js']) },
      fields,
      params: this.paramsOf(raw['params'], fields),
      aspectRatio: this.aspectRatioOf(raw['aspectRatio']),
      moments: this.momentsOf(raw['moments']),
      presetId: typeof raw['presetId'] === 'string' && raw['presetId'] !== '' ? raw['presetId'] : null,
      hidesCaptions: raw['hidesCaptions'] === true,
    };
  }

  /** `value` as the moments a graphic keeps, by the same rules as {@link sanitize}. */
  momentsOf(value: unknown): GraphicMoment[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const moments: GraphicMoment[] = [];
    for (const entry of value) {
      const raw = this.recordOf(entry);
      const id = raw?.['id'];
      const sec = raw?.['sec'];
      if (raw === null || typeof id !== 'string' || !MOMENT_ID.test(id) || seen.has(id)) continue;
      if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) continue;
      seen.add(id);
      const label = typeof raw['label'] === 'string' && raw['label'].trim() !== ''
        ? raw['label'].trim().slice(0, MAX_MOMENT_LABEL_CHARS)
        : id;
      moments.push({ id, label, sec });
    }
    return moments.sort((first, second) => first.sec - second.sec).slice(0, MAX_MOMENTS);
  }

  private fieldsOf(value: unknown): GraphicField[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const fields: GraphicField[] = [];
    for (const entry of value) {
      const raw = this.recordOf(entry);
      const id = raw?.['id'];
      const kind = raw?.['kind'];
      if (raw === null || typeof id !== 'string' || id === '' || seen.has(id)) continue;
      if (typeof kind !== 'string' || !FIELD_KINDS.has(kind)) continue;
      const defaultValue = raw['defaultValue'];
      if (!this.isParamValue(defaultValue) || !this.fitsKind(kind as GraphicFieldKind, defaultValue)) continue;
      seen.add(id);
      const label = typeof raw['label'] === 'string' && raw['label'] !== '' ? raw['label'] : id;
      fields.push({ id, label, kind: kind as GraphicFieldKind, defaultValue });
    }
    return fields;
  }

  private paramsOf(value: unknown, fields: ReadonlyArray<GraphicField>): Record<string, GraphicParamValue> {
    const raw = this.recordOf(value) ?? {};
    const params: Record<string, GraphicParamValue> = {};
    for (const field of fields) {
      const held = raw[field.id];
      if (!this.isParamValue(held) || typeof held !== typeof field.defaultValue) continue;
      if (!this.fitsKind(field.kind, held)) continue;
      params[field.id] = held;
    }
    return params;
  }

  private aspectRatioOf(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return SQUARE;
    return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, value));
  }

  /** Whether a value is one a field of `kind` can hold, beyond being a param value at all. */
  private fitsKind(kind: GraphicFieldKind, value: GraphicParamValue): boolean {
    if (kind === 'image') return this.isImageValue(value);
    if (kind === 'emoji') return this.isEmojiValue(value);
    return true;
  }

  /** Whether `value` is one an emoji field keeps: a string no longer than an emoji sequence can be. */
  isEmojiValue(value: GraphicParamValue): boolean {
    return typeof value === 'string' && value.length <= MAX_EMOJI_CHARS;
  }

  /** Whether `value` is one an image field keeps: none (`''`), or a raster `data:` URL within the size it may take. */
  isImageValue(value: GraphicParamValue): boolean {
    return value === '' || (typeof value === 'string' && value.length <= MAX_IMAGE_CHARS && IMAGE_DATA_URL.test(value));
  }

  private isParamValue(value: unknown): value is GraphicParamValue {
    return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
  }

  private textOf(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private recordOf(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }
}
