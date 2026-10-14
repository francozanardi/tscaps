import { CssClass } from '@modules/document/CssClass';

/**
 * Baseline CSS for painting an element apart from its subtree.
 *
 * Every rule that decides what does not paint is `!important`, which in
 * the framework layer outranks anything a consumer layers after it,
 * animations included: a stylesheet animating `visibility` on a word
 * cannot bring it back where something else paints it.
 *
 * What a copy keeps visible is left to inherit rather than forced on.
 * Forcing it would override a `visibility` an ancestor animates, and the
 * kept element would show through a flash its original hides in. So the
 * boxes a copy keeps only for layout are stripped of what they paint on
 * their own instead — backgrounds, borders, shadows, outlines, backdrop
 * filters and generated content — a closed list of ways a box paints.
 * The exception is an element kept inside one that is hidden there,
 * which has nothing to inherit visibility from.
 *
 * The descendant clause stops a child from refusing the hidden state on
 * its own, which `visibility` otherwise allows.
 */
export const ISOLATION_BASELINE_CSS = `
.${CssClass.ISOLATION_HIDDEN}, .${CssClass.ISOLATION_HIDDEN} *:not(.${CssClass.ISOLATION_KEPT}) { visibility: hidden !important; }
.${CssClass.ISOLATION_KEPT} { visibility: visible; }
.${CssClass.ISOLATION_PATH} { background: none !important; border-color: transparent !important; border-image: none !important; box-shadow: none !important; outline: none !important; backdrop-filter: none !important; }
.${CssClass.ISOLATION_PATH}::before, .${CssClass.ISOLATION_PATH}::after { content: none !important; }`;
