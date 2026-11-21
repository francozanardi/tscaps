/**
 * Where an anchor point lands on the output, its offset included.
 *
 * - `at`: it plays there.
 * - `in-cut`: what it names is cut away; `outputSec` is where the cut
 *   collapses it to. A clip starting there makes no sound.
 * - `hidden`: what it names is an emoji its captions do not show;
 *   `outputSec` is where it would play. A clip starting there makes no
 *   sound until the emoji shows: under another layout, with automatic
 *   emojis on, or once the person's own emoji leaves its caption.
 * - `gone`: what it names no longer exists (a word deleted, an emoji
 *   removed, a shot joined away, a layer removed, the shots proposed
 *   again).
 */
export type AudioAnchorResolution =
  | { readonly kind: 'at'; readonly outputSec: number }
  | { readonly kind: 'in-cut'; readonly outputSec: number }
  | { readonly kind: 'hidden'; readonly outputSec: number }
  | { readonly kind: 'gone' };
