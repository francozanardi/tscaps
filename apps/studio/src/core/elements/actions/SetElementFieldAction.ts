import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementStyle, ElementStyles } from '@core/elements/domain/ElementStyles';
import type { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import type { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import type { ElementControlCssWriter, ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * Moves one of an element's own fields.
 *
 * The value and the declaration it produces are written in the same
 * step, so the record and the CSS always say the same thing until
 * somebody edits the CSS.
 */
export class SetElementFieldAction {
  constructor(
    private readonly store: EditorStore,
    private readonly catalog: StyledElementCatalog,
    private readonly descendantResolver: ElementDescendantResolver,
    private readonly writer: ElementControlCssWriter,
    private readonly cssControlledFieldFinder: CssControlledFieldFinder,
    private readonly refresh: RefreshDocumentAction,
  ) {}

  /** Everything inside the element gives the field up, so the answer given here is the one that renders. */
  execute(elementId: string | ReadonlyArray<string>, kind: ElementKind, control: AuthoredElementControl, value: ElementControlValue): void {
    const snap = this.store.snapshot();
    const elementIds = typeof elementId === 'string' ? [elementId] : elementId;
    let next = snap.elementStyles;
    for (const id of elementIds) {
      const style = next.get(id);
      const css = this.writer.write(style?.css ?? '', control, value);
      const set = next.withField(id, kind, control.id, value, css);
      next = this.forgottenInside(set, id, kind, control);
    }
    const key = elementIds.length === 1 ? elementIds[0]! : `selection:${[...elementIds].sort().join(',')}`;
    this.apply(next, `${key}:${control.id}`);
  }

  /**
   * Puts the field back to whatever the element would look like
   * without it.
   *
   * A declaration somebody has edited is left exactly as it was: the
   * field gives up its claim on the property rather than overwriting
   * an answer it did not write.
   */
  clear(elementId: string, kind: ElementKind, control: AuthoredElementControl): void {
    const snap = this.store.snapshot();
    const style = snap.elementStyles.get(elementId);
    if (!style) return;
    const css = this.cssWithoutField(style, control);
    this.apply(snap.elementStyles.withoutField(elementId, kind, control.id, css), `${elementId}:${control.id}`);
  }

  /**
   * Takes the field off every element inside this one.
   *
   * An element that had been given its own answer keeps deciding for
   * itself forever otherwise: turning a caption's underline on leaves
   * the one word somebody had turned it off on alone, and there is no
   * way back to inherited short of finding that word again. Answering
   * further out is the way the user says "all of this", so it wins over
   * what is inside.
   *
   * Only for a field that arrives from further out at all. A ratio and
   * a rotation compose with the ones around them rather than replacing
   * them, so an answer given here leaves what is inside meaning exactly
   * what it meant.
   */
  private forgottenInside(
    styles: ElementStyles,
    elementId: string,
    kind: ElementKind,
    control: AuthoredElementControl,
  ): ElementStyles {
    if (!this.catalog.reachesInside(kind, control)) return styles;
    let next = styles;
    for (const descendantId of this.descendantResolver.descendantsOf(elementId)) {
      const style = next.get(descendantId);
      if (style?.fields?.[control.id] === undefined) continue;
      const own = this.catalog.sameFieldOn(style.kind, control);
      if (!own) continue;
      next = next.withoutField(descendantId, style.kind, control.id, this.cssWithoutField(style, own));
    }
    return next;
  }

  /** The element's CSS once the field stops writing, leaving a declaration somebody has edited as it was. */
  private cssWithoutField(style: ElementStyle, control: AuthoredElementControl): string {
    const editedByHand = this.cssControlledFieldFinder.find(style, [control]).has(control.id);
    if (editedByHand) return style.css;
    return this.stillClaimed(this.writer.remove(style.css, control), style, control);
  }

  /**
   * Writes back what the other fields over the same property still
   * hold.
   *
   * Two switches can share one declaration — underline and
   * strikethrough do, since CSS offers no longhand for either alone —
   * and the last token leaving takes the whole declaration with it. The
   * other field's answer would go with it while its value stayed
   * recorded, and it would then report a declaration nobody touched as
   * one somebody edited.
   */
  private stillClaimed(css: string, style: ElementStyle, control: AuthoredElementControl): string {
    let next = css;
    for (const sibling of this.catalog.controlsFor(style.kind)) {
      if (sibling.id === control.id || sibling.property !== control.property) continue;
      const held = style.fields?.[sibling.id];
      if (held !== undefined) next = this.writer.write(next, sibling, held);
    }
    return next;
  }

  /**
   * Coalesces into one undo step per field, so dragging a slider or a
   * colour leaves a single entry rather than one per tick.
   */
  private apply(elementStyles: ElementStyles, fieldKey: string): void {
    const snap = this.store.snapshot();
    if (elementStyles === snap.elementStyles) return;

    this.store.commit(`elementField:${fieldKey}`);
    this.store.patch({ elementStyles });
    if (this.store.snapshot().frozenSegments !== snap.frozenSegments) this.refresh.execute();
  }
}
