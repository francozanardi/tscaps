import type { EditorStore } from '@core/editor/store/EditorStore';

/** Where an element's own CSS lives: a caption element's style, or a shot layer's (a shot's own video included). */
export interface ElementCssTarget {
  readonly holder: 'caption' | 'layer';
  readonly id: string;
}

/**
 * The CSS each element carried when it was last read, so that CSS written
 * over it can be refused when it changed in between.
 *
 * An element's CSS is one text that several hands write: the fields and
 * the animations set on it write their part, the person writes in the
 * editor, a tool writes the whole. Replacing it without having seen what
 * it holds now drops what the others wrote without anyone noticing, and
 * writing over a text since emptied puts back what someone took out. A
 * read is whatever showed the text: reading the element, writing it, or
 * the answer to a refused write.
 */
export class ElementCssReads {
  private readonly seen = new Map<string, string>();

  constructor(private readonly store: EditorStore) {}

  /** Records the CSS `target` carries now as read. */
  markRead(target: ElementCssTarget): void {
    this.seen.set(this.keyOf(target), this.cssOf(target));
  }

  /**
   * The CSS `target` carries now, when it is not what was last read or
   * written of it, an emptied text included; null when it may be written
   * over. An element never read may be written over only while it
   * carries nothing.
   */
  unreadChange(target: ElementCssTarget): string | null {
    const css = this.cssOf(target);
    const seen = this.seen.get(this.keyOf(target));
    const known = seen === undefined ? css.trim().length === 0 : seen === css;
    return known ? null : css;
  }

  private cssOf(target: ElementCssTarget): string {
    const state = this.store.snapshot();
    const styles = target.holder === 'caption' ? state.elementStyles : state.shots.layerStyles;
    return styles.get(target.id)?.css ?? '';
  }

  private keyOf(target: ElementCssTarget): string {
    return `${target.holder}:${target.id}`;
  }
}
