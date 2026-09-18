import { FontStackCssVariable } from '@core/fonts/domain/FontStackCssVariable';
import {
  CssClass,
  CssVariable,
  Decoration,
  Letter,
  Line,
  LineState,
  Segment,
  StructureTag,
  Word,
  WordState,
} from '@tscaps/engine';
import { TemplateCssVariable } from '@core/templates/domain/definition/TemplateCssVariable';
import { SvgFilterRuntimeVariable } from '@core/templates/domain/definition/SvgFilterRuntimeVariable';
import { ControlCssVariable } from '@core/templates/domain/definition/ControlCssVariable';
import { TAG_NAMES } from '@core/tagging/domain/TagName';

/**
 * The styling contract between the runtime (engine + editor) and
 * template source: which CSS custom properties have a writer, and
 * which class names the renderer actually emits. Assembled from the
 * same enums and constants the emitting code uses, so the contract
 * cannot drift from the code.
 *
 * The `--tscaps-*` namespace is open by design — every style control
 * a template declares becomes a variable — so variable sets are
 * resolved per template through the `styleControlIds` parameter
 * rather than from a fixed allowlist.
 */
export class StyleContract {
  private readonly fixedVariables: ReadonlySet<string>;
  private readonly filterRuntimeVariables: ReadonlySet<string>;
  private readonly rendererClasses: ReadonlySet<string>;

  constructor() {
    this.fixedVariables = new Set<string>([
      ...Object.values(CssVariable),
      ...Object.values(TemplateCssVariable),
    ]);
    this.filterRuntimeVariables = new Set<string>(Object.values(SvgFilterRuntimeVariable));
    this.rendererClasses = new Set<string>([
      Segment.CSS_CLASS,
      Line.CSS_CLASS,
      Word.CSS_CLASS,
      Letter.CSS_CLASS,
      Decoration.CSS_CLASS,
      ...Object.values(WordState),
      ...Object.values(LineState),
      ...Object.values(StructureTag),
      ...Object.values(CssClass),
      ...TAG_NAMES,
    ]);
  }

  /**
   * Custom properties a template's `style.css` may read: the fixed
   * engine/editor set plus one variable per declared style control.
   */
  cssVariablesFor(styleControlIds: ReadonlyArray<string>, fontStackIds: readonly string[] = []): ReadonlySet<string> {
    const names = this.withControlVariables(styleControlIds);
    for (const id of fontStackIds) names.add(FontStackCssVariable.nameFor(id));
    return names;
  }

  /**
   * Custom properties a template's `filters.svg` may read: the CSS
   * set plus the time-derived helpers only the filter scope provides.
   */
  filtersSvgVariablesFor(styleControlIds: ReadonlyArray<string>): ReadonlySet<string> {
    const names = this.withControlVariables(styleControlIds);
    for (const name of this.filterRuntimeVariables) names.add(name);
    return names;
  }

  /**
   * Every class name the renderer can emit on caption DOM: structural
   * node classes, per-frame state classes, structural tag classes,
   * and the semantic tag vocabulary.
   */
  rendererEmittedClasses(): ReadonlySet<string> {
    return this.rendererClasses;
  }

  private withControlVariables(styleControlIds: ReadonlyArray<string>): Set<string> {
    const names = new Set(this.fixedVariables);
    for (const id of styleControlIds) names.add(ControlCssVariable.nameFor(id));
    return names;
  }
}
