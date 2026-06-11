import { SvgFilter } from '@modules/svg-filter/SvgFilter';
import { SvgFilterDefinitions } from '@modules/svg-filter/SvgFilterDefinitions';

const SMIL_TAGS: ReadonlyArray<string> = ['animate', 'animateTransform', 'animateMotion', 'set'];

const COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * Reads an SVG source string and produces an `SvgFilterDefinitions`
 * containing one `SvgFilter` per `<filter id="…">` element found.
 *
 * Comments are stripped before parsing so authors may mention `--`
 * sequences (e.g. a `var(--name)` reference) inside `<!-- … -->`
 * without tripping the XML rule against `--` in comment bodies, and
 * so the parsed bodies don't carry comments into the rendered SVG
 * payload.
 *
 * SMIL animation elements (`<animate>`, `<set>`, `<animateTransform>`,
 * `<animateMotion>`) are rejected. They don't tick when the SVG is
 * decoded as an image, which produces a frozen filter instead of a
 * playing one — invariably a bug.
 */
export class SvgFilterDefinitionsParser {
  parse(source: string): SvgFilterDefinitions {
    const stripped = source.replace(COMMENT_RE, '');
    const doc = new DOMParser().parseFromString(stripped, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`SVG filter parse error: ${parseError.textContent ?? 'unknown'}`);
    }
    const serializer = new XMLSerializer();
    const filters = Array.from(doc.querySelectorAll('filter')).map((el) => {
      const id = el.getAttribute('id');
      if (!id) {
        throw new Error('Every <filter> must have an id attribute');
      }
      this.assertNoSmil(el, id);
      const body = Array.from(el.childNodes).map((n) => serializer.serializeToString(n)).join('');
      return new SvgFilter(id, body);
    });
    return new SvgFilterDefinitions(filters);
  }

  private assertNoSmil(filterEl: Element, filterId: string): void {
    for (const tag of SMIL_TAGS) {
      if (filterEl.querySelector(tag)) {
        throw new Error(
          `<${tag}> is not supported inside <filter id="${filterId}">. ` +
          `SMIL animations don't tick in image-decoded SVG. ` +
          `Animate via CSS keyframes that swap between filter variants instead.`,
        );
      }
    }
  }
}
