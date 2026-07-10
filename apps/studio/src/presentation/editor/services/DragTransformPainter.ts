/**
 * Writes the in-flight drag offset onto the affected elements. Keeps
 * the per-pointermove DOM mutation in one place and out of React's
 * render path. The set of targets a single gesture affects depends on
 * the gesture kind (segment drag moves every active wrapper; word
 * drag moves a single word span) — the caller picks which elements;
 * this class only paints.
 *
 * Uses `position: relative` + `top`/`left` rather than `transform`
 * for two reasons: (1) `transform` creates a new stacking context on
 * the target, which traps any `mix-blend-mode` it carries and breaks
 * the blend against the underlying video (the word goes invisible
 * for blend modes like `multiply`); (2) without a `z-index`,
 * `position: relative` does NOT create a stacking context, so the
 * blend keeps working through the drag. All three properties are
 * written with `!important` to win against template animations or
 * cascade rules that target the same element class.
 */
export class DragTransformPainter {
  applyTranslate(targets: Iterable<HTMLElement>, deltaX: number, deltaY: number): void {
    const top = `${deltaY}px`;
    const left = `${deltaX}px`;
    for (const target of targets) {
      target.style.setProperty('position', 'relative', 'important');
      target.style.setProperty('top', top, 'important');
      target.style.setProperty('left', left, 'important');
    }
  }

  clear(targets: Iterable<HTMLElement>): void {
    for (const target of targets) {
      target.style.removeProperty('position');
      target.style.removeProperty('top');
      target.style.removeProperty('left');
    }
  }
}
