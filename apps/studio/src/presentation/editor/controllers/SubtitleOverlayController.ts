import type { Segment, Line, Word, Decoration } from '@tscaps/engine';
import { SvgFilterBundle, SvgFilterScoper, SvgFilterLengthResolver } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { SheetSvgFilterScopeProvider } from '@core/sheets/services/SheetSvgFilterScopeProvider';
import type { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import type { EditorStore } from '@core/editor/store/EditorStore';

interface WordBinding {
  word: Word;
  segment: Segment;
  indexInLine: number;
}

interface LineBinding {
  line: Line;
  segment: Segment;
}

interface SegmentBinding {
  segment: Segment;
  indexInSection: number;
}

interface DecorationBinding {
  decoration: Decoration;
  segment: Segment;
  word: Word;
}

interface SheetFilterDefsBinding {
  sheet: Sheet;
}

/**
 * Owns the time-driven DOM state of the subtitle overlay. The
 * rendering layer mounts the structural tree (which segments /
 * lines / words exist on screen) and registers each animated
 * element here; the controller subscribes to the store's
 * `timechange` event and writes `className`, CSS variables, and
 * SVG filter defs onto those elements on every tick. One time
 * observer fans out to many DOM nodes — the rendering layer
 * never re-runs per frame.
 *
 * Ownership contract: the controller is the sole writer of
 * `className` on bound word/line/segment elements, of the
 * time-varying CSS variable keys produced by
 * `Word/Line/Segment.getCssVariables`, and of the sheet
 * filter-defs `<g>`'s `innerHTML`. The caller must not write those
 * properties or those CSS variable keys on a bound element.
 *
 * Lifecycle is `start()` / `stop()`. Bindings can be added or
 * removed at any time between those calls; each `bind*` method
 * applies the current frame immediately and returns a disposer
 * that removes the binding.
 *
 * Callers supply the ancestor context the engine needs to emit
 * timing / index variables (segment time for lines and words,
 * position-in-line for words, etc.) — the document tree does not
 * carry parent backpointers.
 */
export class SubtitleOverlayController {
  private readonly wordBindings = new Map<HTMLElement, WordBinding>();
  private readonly lineBindings = new Map<HTMLElement, LineBinding>();
  private readonly segmentBindings = new Map<HTMLElement, SegmentBinding>();
  private readonly decorationBindings = new Map<HTMLElement, DecorationBinding>();
  private readonly sheetFilterDefsBindings = new Map<SVGGElement, SheetFilterDefsBinding>();
  private readonly lengthResolver = new SvgFilterLengthResolver();
  private readonly filterScoper = new SvgFilterScoper();
  private running = false;
  private renderHeightPx = 0;

  constructor(
    private readonly store: EditorStore,
    private readonly svgFilterDefinitionsResolver: SheetSvgFilterDefinitionsResolver,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.store.addEventListener('timechange', this.onTimeChange);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.store.removeEventListener('timechange', this.onTimeChange);
    this.wordBindings.clear();
    this.lineBindings.clear();
    this.segmentBindings.clear();
    this.decorationBindings.clear();
    this.sheetFilterDefsBindings.clear();
  }

  bindWord(element: HTMLElement, word: Word, segment: Segment, indexInLine: number): () => void {
    const binding: WordBinding = { word, segment, indexInLine };
    this.wordBindings.set(element, binding);
    this.applyWord(element, binding, this.currentTime());
    return () => { this.wordBindings.delete(element); };
  }

  bindLine(element: HTMLElement, line: Line, segment: Segment): () => void {
    const binding: LineBinding = { line, segment };
    this.lineBindings.set(element, binding);
    this.applyLine(element, binding, this.currentTime());
    return () => { this.lineBindings.delete(element); };
  }

  bindSegment(element: HTMLElement, segment: Segment, indexInSection: number): () => void {
    const binding: SegmentBinding = { segment, indexInSection };
    this.segmentBindings.set(element, binding);
    this.applySegment(element, binding, this.currentTime());
    return () => { this.segmentBindings.delete(element); };
  }

  bindDecoration(element: HTMLElement, decoration: Decoration, segment: Segment, word: Word): () => void {
    const binding: DecorationBinding = { decoration, segment, word };
    this.decorationBindings.set(element, binding);
    this.applyDecoration(element, binding, this.currentTime());
    return () => { this.decorationBindings.delete(element); };
  }

  /**
   * Binds an SVG `<g>` whose `innerHTML` receives the materialized
   * `<filter>` defs for a sheet on every frame. Sits inside a shared
   * hidden `<svg>`; the controller does not own that container.
   */
  bindSheetFilterDefs(element: SVGGElement, sheet: Sheet): () => void {
    this.sheetFilterDefsBindings.set(element, { sheet });
    this.applySheetFilterDefs(element, this.materializeFilterDefsHtml(sheet, this.currentTime()));
    return () => { this.sheetFilterDefsBindings.delete(element); };
  }

  /**
   * Sets the px height of the render target the preview draws into (the
   * displayed video box). SVG filter lengths authored in `em`/`cqh`
   * resolve against it, so a change re-materializes every bound sheet's
   * filter defs at the current frame.
   */
  setRenderHeight(px: number): void {
    if (px === this.renderHeightPx) return;
    this.renderHeightPx = px;
    const t = this.currentTime();
    for (const [element, binding] of this.sheetFilterDefsBindings) {
      this.applySheetFilterDefs(element, this.materializeFilterDefsHtml(binding.sheet, t));
    }
  }

  private currentTime(): number {
    return this.store.snapshot().video.currentTime;
  }

  private readonly onTimeChange = (): void => {
    const t = this.currentTime();
    for (const [element, binding] of this.sheetFilterDefsBindings) {
      this.applySheetFilterDefs(element, this.materializeFilterDefsHtml(binding.sheet, t));
    }
    for (const [element, binding] of this.segmentBindings) this.applySegment(element, binding, t);
    for (const [element, binding] of this.lineBindings) this.applyLine(element, binding, t);
    for (const [element, binding] of this.wordBindings) this.applyWord(element, binding, t);
    for (const [element, binding] of this.decorationBindings) this.applyDecoration(element, binding, t);
  };

  private materializeFilterDefsHtml(sheet: Sheet, currentTime: number): string {
    const definitions = this.svgFilterDefinitionsResolver.resolve(sheet);
    const bundle = new SvgFilterBundle(definitions, new SheetSvgFilterScopeProvider(sheet));
    const context = { currentTime, renderHeightPx: this.renderHeightPx };
    const scope = bundle.scopeProvider.scopeAt(context);
    const lengthFactors = bundle.scopeProvider.lengthFactorsAt(context);
    const { idByLocal } = this.filterScoper.scopeIds(bundle.definitions.ids, sheet.id);
    return bundle.definitions.filters
      .map((filter) => {
        const body = this.lengthResolver.resolve(filter.materialize(scope), lengthFactors);
        return `<filter id="${idByLocal.get(filter.id)}">${body}</filter>`;
      })
      .join('');
  }

  private applyWord(element: HTMLElement, binding: WordBinding, currentTime: number): void {
    element.className = binding.word.getCssClasses(currentTime).join(' ');
    this.writeVars(element, binding.word.getCssVariables(currentTime, {
      segTime: binding.segment.time,
      indexInLine: binding.indexInLine,
    }));
  }

  private applyLine(element: HTMLElement, binding: LineBinding, currentTime: number): void {
    element.className = binding.line.getCssClasses(currentTime).join(' ');
    this.writeVars(element, binding.line.getCssVariables(currentTime, {
      segTime: binding.segment.time,
    }));
  }

  private applySegment(element: HTMLElement, binding: SegmentBinding, currentTime: number): void {
    element.className = binding.segment.getCssClasses(currentTime).join(' ');
    this.writeVars(element, binding.segment.getCssVariables(currentTime, {
      indexInSection: binding.indexInSection,
    }));
  }

  private applyDecoration(element: HTMLElement, binding: DecorationBinding, currentTime: number): void {
    this.writeVars(element, binding.decoration.getCssVariables(currentTime, {
      segTime: binding.segment.time,
      wordTime: binding.word.time,
    }));
  }

  private applySheetFilterDefs(element: SVGGElement, defsHtml: string): void {
    element.innerHTML = defsHtml;
  }

  private writeVars(element: HTMLElement, vars: Record<string, string>): void {
    for (const [key, value] of Object.entries(vars)) {
      element.style.setProperty(key, value);
    }
  }
}
