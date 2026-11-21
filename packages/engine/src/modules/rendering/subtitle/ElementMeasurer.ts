import type { Segment } from '@modules/document/Segment';
import { CssVariable } from '@modules/document/CssVariable';
import { DataAttribute } from '@modules/document/DataAttribute';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { SegmentSubtreeHtmlBuilder, SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import type { LayoutWidthReader } from '@modules/rendering/subtitle/LayoutWidthReader';
import type { GlyphInkExtents, GlyphInkReader } from '@modules/rendering/subtitle/GlyphInkReader';
import { ElementMeasures } from '@modules/rendering/subtitle/ElementMeasures';
import { profiler } from '@modules/profiling/Profiler';

const WIDTH_VARIABLES: ReadonlyArray<string> = [
  CssVariable.SEGMENT_WIDTH_EM,
  CssVariable.LINE_WIDTH_EM,
  CssVariable.PREVIOUS_LINE_WIDTH_EM,
  CssVariable.WORD_WIDTH_EM,
];

const INK_VARIABLES: ReadonlyArray<string> = [
  CssVariable.LINE_INK_ASCENT_EM,
  CssVariable.LINE_INK_DESCENT_EM,
];

/**
 * How a caption's elements lay out, measured by mounting the subtree
 * under the consumer's own stylesheet: how wide layout made each box,
 * before any transform, and how far each line's glyphs reach above and
 * below its baseline. Answers once per caption per style and reuses that
 * for every frame the caption is on screen; `clear` drops what it kept.
 *
 * Segments, lines and words answer their width, and lines their ink;
 * nothing else does. They are what a stylesheet lays text out in, and
 * every extra kind costs another custom property on every rendered
 * element for a question no stylesheet has asked yet. Adding a kind is
 * adding its variable here.
 *
 * A style whose CSS reads none of the properties is never measured: the
 * work is a mount and a layout read, and nothing would consume it. The
 * widths and the ink are read only when the CSS reads some of each.
 *
 * Measuring the subtree as it is really built is what keeps the answer
 * honest. Whatever classes the caption carries at that moment are on
 * it, so a template that restyles a whole caption on a render state is
 * measured in the typography that state produces, with no second
 * description of that state to keep in step.
 */
export class ElementMeasurer {
  private readonly measuresByKey = new Map<string, ElementMeasures>();

  constructor(
    private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder,
    private readonly widthReader: LayoutWidthReader,
    private readonly inkReader: GlyphInkReader,
    private readonly viewportWidth: number,
    private readonly viewportHeight: number,
  ) {}

  measuresFor(
    style: PreparedStyle,
    styleInput: SegmentSubtreeStyleInput,
    segment: Segment,
    t: number,
    segmentIndex: number,
  ): ElementMeasures {
    if (!this.styleReadsAny(style, WIDTH_VARIABLES) && !this.styleReadsAny(style, INK_VARIABLES)) {
      return ElementMeasures.empty();
    }
    const key = `${style.kind}:${segment.id}`;
    let measures = this.measuresByKey.get(key);
    if (!measures) {
      measures = this.measure(style, styleInput, segment, t, segmentIndex);
      this.measuresByKey.set(key, measures);
    }
    return measures;
  }

  clear(): void {
    this.measuresByKey.clear();
  }

  private styleReadsAny(style: PreparedStyle, properties: ReadonlyArray<string>): boolean {
    return properties.some((property) => style.usedCssVars.has(property));
  }

  private measure(
    style: PreparedStyle,
    styleInput: SegmentSubtreeStyleInput,
    segment: Segment,
    t: number,
    segmentIndex: number,
  ): ElementMeasures {
    const host = document.createElement('div');
    host.style.cssText = `container-type: size; width: ${this.viewportWidth}px; height: ${this.viewportHeight}px;`;
    const inner = document.createElement('div');
    inner.style.cssText = 'display:inline-block;';
    profiler.time('ElementMeasurer.mount', () => {
      inner.innerHTML = this.buildMeasurableSubtree(styleInput, segment, t, segmentIndex);
      host.appendChild(inner);
      style.probeContainer.appendChild(host);
    });
    try {
      return profiler.time('ElementMeasurer.read', () => new ElementMeasures(
        this.styleReadsAny(style, WIDTH_VARIABLES) ? this.readWidths(inner) : new Map(),
        this.styleReadsAny(style, INK_VARIABLES) ? this.readLineInk(inner, segment) : new Map(),
      ));
    } finally {
      style.probeContainer.removeChild(host);
    }
  }

  /**
   * The subtree as it will really be built, with every element named so
   * its box can be found again afterwards.
   *
   * The widths are deliberately absent from it. A stylesheet sizing text
   * from its own width would otherwise have to be measured at the size
   * it is being asked to produce; leaving the properties unset lets the
   * rule fall back, and since the answer is a multiple of the font size,
   * whichever size the fallback lands on gives the same one.
   */
  private buildMeasurableSubtree(
    styleInput: SegmentSubtreeStyleInput,
    segment: Segment,
    t: number,
    segmentIndex: number,
  ): string {
    const named = { ...styleInput, addressableElementIds: this.everyElementId(segment) };
    return this.subtreeBuilder.buildSegmentSubtree(named, segment, t, new Set<string>(), segmentIndex);
  }

  private everyElementId(segment: Segment): ReadonlySet<string> {
    const ids = new Set<string>([segment.id]);
    for (const line of segment.lines) {
      ids.add(line.id);
      for (const word of line.words) ids.add(word.id);
    }
    return ids;
  }

  /**
   * An element that generates no box reports zero. That is the true
   * answer rather than a missing one — a stylesheet asking the width of
   * something it took out of flow is asking about a box that is not
   * there.
   */
  private readWidths(host: HTMLElement): Map<string, number> {
    const widthEmByElementId = new Map<string, number>();
    for (const element of host.querySelectorAll<HTMLElement>(`[${DataAttribute.ELEMENT_ID}]`)) {
      const elementId = element.getAttribute(DataAttribute.ELEMENT_ID);
      if (elementId) widthEmByElementId.set(elementId, this.widthReader.widthEm(element));
    }
    return widthEmByElementId;
  }

  private readLineInk(host: HTMLElement, segment: Segment): Map<string, GlyphInkExtents> {
    const inkByLineId = new Map<string, GlyphInkExtents>();
    for (const line of segment.lines) {
      const element = host.querySelector<HTMLElement>(`[${DataAttribute.ELEMENT_ID}="${CSS.escape(line.id)}"]`);
      const ink = element ? this.inkReader.extentsEm(element) : null;
      if (ink) inkByLineId.set(line.id, ink);
    }
    return inkByLineId;
  }
}
