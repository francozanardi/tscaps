import type { Segment } from '@modules/document/Segment';
import { CssVariable } from '@modules/document/CssVariable';
import { DataAttribute } from '@modules/document/DataAttribute';
import type { PreparedStyle } from '@modules/rendering/subtitle/PreparedStyle';
import type { SegmentSubtreeHtmlBuilder, SegmentSubtreeStyleInput } from '@modules/rendering/subtitle/SegmentSubtreeHtmlBuilder';
import { ElementWidths } from '@modules/rendering/subtitle/ElementWidths';
import { profiler } from '@modules/profiling/Profiler';

const WIDTH_VARIABLES: ReadonlyArray<string> = [
  CssVariable.SEGMENT_WIDTH_EM,
  CssVariable.LINE_WIDTH_EM,
  CssVariable.PREVIOUS_LINE_WIDTH_EM,
  CssVariable.WORD_WIDTH_EM,
];

/**
 * How wide a caption's elements lay out, measured by mounting the
 * subtree under the consumer's own stylesheet and reading the boxes
 * back. Answers once per caption per style and reuses that for every
 * frame the caption is on screen; `clear` drops what it kept.
 *
 * Segments, lines and words answer, and nothing else does. They are the
 * three a stylesheet lays text out in, and every extra kind costs
 * another custom property on every rendered element for a question no
 * stylesheet has asked yet. Adding a kind is adding its variable here.
 *
 * A style whose CSS reads none of the properties is never measured: the
 * work is a mount and a layout read, and nothing would consume it.
 *
 * Measuring the subtree as it is really built is what keeps the answer
 * honest. Whatever classes the caption carries at that moment are on
 * it, so a template that restyles a whole caption on a render state is
 * measured in the typography that state produces, with no second
 * description of that state to keep in step.
 */
export class ElementWidthMeasurer {
  private readonly widthsByKey = new Map<string, ElementWidths>();

  constructor(
    private readonly subtreeBuilder: SegmentSubtreeHtmlBuilder,
    private readonly viewportWidth: number,
    private readonly viewportHeight: number,
  ) {}

  widthsFor(
    style: PreparedStyle,
    styleInput: SegmentSubtreeStyleInput,
    segment: Segment,
    t: number,
    indexInSection: number,
  ): ElementWidths {
    if (!this.styleReadsAnyWidth(style)) return ElementWidths.empty();
    const key = `${style.kind}:${segment.id}`;
    let widths = this.widthsByKey.get(key);
    if (!widths) {
      widths = this.measure(style, styleInput, segment, t, indexInSection);
      this.widthsByKey.set(key, widths);
    }
    return widths;
  }

  clear(): void {
    this.widthsByKey.clear();
  }

  private styleReadsAnyWidth(style: PreparedStyle): boolean {
    return WIDTH_VARIABLES.some((property) => style.usedCssVars.has(property));
  }

  private measure(
    style: PreparedStyle,
    styleInput: SegmentSubtreeStyleInput,
    segment: Segment,
    t: number,
    indexInSection: number,
  ): ElementWidths {
    const host = document.createElement('div');
    host.style.cssText = `container-type: size; width: ${this.viewportWidth}px; height: ${this.viewportHeight}px;`;
    const inner = document.createElement('div');
    inner.style.cssText = 'display:inline-block;';
    profiler.time('ElementWidthMeasurer.mount', () => {
      inner.innerHTML = this.buildMeasurableSubtree(styleInput, segment, t, indexInSection);
      host.appendChild(inner);
      style.probeContainer.appendChild(host);
    });
    try {
      return profiler.time('ElementWidthMeasurer.read', () => this.readWidths(inner));
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
    indexInSection: number,
  ): string {
    const named = { ...styleInput, addressableElementIds: this.everyElementId(segment) };
    return this.subtreeBuilder.buildSegmentSubtree(named, segment, t, new Set<string>(), indexInSection);
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
  private readWidths(host: HTMLElement): ElementWidths {
    const widthEmByElementId = new Map<string, number>();
    for (const element of host.querySelectorAll<HTMLElement>(`[${DataAttribute.ELEMENT_ID}]`)) {
      const elementId = element.getAttribute(DataAttribute.ELEMENT_ID);
      if (elementId) widthEmByElementId.set(elementId, this.widthEmOf(element));
    }
    return new ElementWidths(widthEmByElementId);
  }

  private widthEmOf(element: HTMLElement): number {
    const fontSizePx = parseFloat(window.getComputedStyle(element).fontSize) || 0;
    if (fontSizePx <= 0) return 0;
    return element.getBoundingClientRect().width / fontSizePx;
  }
}
