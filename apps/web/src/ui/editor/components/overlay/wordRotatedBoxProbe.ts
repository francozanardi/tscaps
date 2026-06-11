export interface WordRotatedBoxLayout {
  /** Visual centre of the rendered word in viewport (`clientX`/`clientY`) coordinates. */
  readonly visualCenterX: number;
  readonly visualCenterY: number;
  /** Layout dimensions before any rotation — the size the chrome
   *  frame should adopt so its corners land at the rotated glyph box,
   *  not at the axis-aligned bounding rect. */
  readonly unrotatedWidth: number;
  readonly unrotatedHeight: number;
  /** CSS transform value (e.g. `"rotate(15deg)"`) matching the word's
   *  effective rotation — ready to assign to `style.transform` on the
   *  chrome frame so its visual orientation tracks the rotated word.
   *  `"none"` when the effective rotation is zero. */
  readonly transform: string;
}

/**
 * Measures the rotated glyph box of one rendered word so chrome
 * components (selection ring, resize handles, rotation handle) can
 * frame the glyphs even when the word — or any of its ancestors —
 * carries a rotation.
 *
 * Returns `null` when the span is not present in the DOM — happens
 * briefly during re-derivation between renders. Consumers should treat
 * a `null` result as "hide for this tick" and call again when the next
 * layout settles.
 *
 * The effective rotation walks every ancestor from the span up to
 * `scope` (exclusive) and sums each element's standalone `rotate` plus
 * any rotation embedded in its `transform` matrix — so a word inside a
 * segment wrapper that carries `transform: rotate(...)` rotates the
 * chrome by the segment's angle even when the word itself has none.
 */
export function measureWordRotatedBox(scope: HTMLElement, wordId: string): WordRotatedBoxLayout | null {
  const selector = `[data-tscaps-word-id="${CSS.escape(wordId)}"]`;
  const el = scope.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const rotationDeg = readEffectiveRotationDegrees(el, scope);
  return {
    visualCenterX: rect.left + rect.width / 2,
    visualCenterY: rect.top + rect.height / 2,
    unrotatedWidth: el.offsetWidth,
    unrotatedHeight: el.offsetHeight,
    transform: rotationDeg === 0 ? 'none' : `rotate(${rotationDeg}deg)`,
  };
}

function readEffectiveRotationDegrees(el: HTMLElement, scope: HTMLElement): number {
  let total = 0;
  let current: HTMLElement | null = el;
  while (current && current !== scope) {
    total += readStandaloneRotationDegrees(current);
    total += readTransformRotationDegrees(current);
    current = current.parentElement;
  }
  return total;
}

function readStandaloneRotationDegrees(el: HTMLElement): number {
  const rotate = window.getComputedStyle(el).rotate;
  if (!rotate || rotate === 'none') return 0;
  const match = /^(-?\d*\.?\d+)deg$/.exec(rotate.trim());
  return match ? Number(match[1]) : 0;
}

// Extracts the rotation embedded in the computed `transform` matrix
// using `atan2(b, a)`. Correct for pure-rotation transforms (the only
// kind the editor wrapper sets); a composite that also scaled or skewed
// would need an SVD to recover the angle, but those don't appear in
// this subtree.
function readTransformRotationDegrees(el: HTMLElement): number {
  const value = window.getComputedStyle(el).transform;
  if (!value || value === 'none') return 0;
  const match = /^matrix\(([^)]+)\)$/.exec(value.trim());
  const body = match?.[1];
  if (body === undefined) return 0;
  const [a, b] = body.split(',').map((part) => parseFloat(part.trim()));
  if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.atan2(b, a) * (180 / Math.PI);
}
