/**
 * Walks ArrowUp / ArrowDown across segment textareas as if the captions
 * sidebar were one continuous document. Each textarea handles intra-segment
 * motion natively (including line wrapping); when the caret can't move any
 * further in the requested direction the controller hops focus to the
 * previous / next `textarea[data-segment-id]` in DOM order and lands the
 * caret on the boundary line of the destination at the same column,
 * clamped to that line's length.
 *
 * No persistent goal column is preserved across hops: once the column is
 * clamped to a shorter line, that becomes the new column for subsequent
 * navigation.
 *
 * Boundary detection is deferred — after a keypress, the controller checks
 * whether `selectionStart` actually changed. If not, the caret was pinned
 * at the boundary visual line (including wrapped first/last lines) and the
 * hop fires. Consequence: from a non-zero column on the first visual line,
 * ArrowUp first collapses to column 0 (native behavior) and a second press
 * hops — same pattern as a single multi-line textarea.
 *
 * Call `start` / `stop` to install or remove the global keydown listener.
 */
export class SegmentTextareaArrowNavigationController {
  start(): void {
    window.document.addEventListener('keydown', this.onKey, true);
  }

  stop(): void {
    window.document.removeEventListener('keydown', this.onKey, true);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const ta = e.target;
    if (!(ta instanceof HTMLTextAreaElement)) return;
    if (ta.dataset.segmentId === undefined) return;
    const before = ta.selectionStart;
    const direction: 'up' | 'down' = e.key === 'ArrowUp' ? 'up' : 'down';
    requestAnimationFrame(() => {
      if (ta.selectionStart !== before) return;
      this.hop(ta, direction);
    });
  };

  private hop(source: HTMLTextAreaElement, direction: 'up' | 'down'): void {
    const all = Array.from(
      window.document.querySelectorAll<HTMLTextAreaElement>('textarea[data-segment-id]'),
    );
    const idx = all.indexOf(source);
    if (idx < 0) return;
    const target = direction === 'up' ? all[idx - 1] : all[idx + 1];
    if (!target) return;
    const column = this.columnOf(source.value, source.selectionStart);
    const caret = this.caretIn(target.value, direction === 'up' ? 'last' : 'first', column);
    // Chrome's native focus-into-view jumps virtualizer items (transformed
    // absolute positioning) toward the viewport center instead of the
    // closest edge. Suppress it and scroll the scene wrapper explicitly
    // with `nearest`, so a single arrow press moves the view by one card.
    target.focus({ preventScroll: true });
    target.setSelectionRange(caret, caret);
    const scrollTarget = target.closest('[data-scene-card]') ?? target;
    scrollTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private columnOf(value: string, pos: number): number {
    const prevNewline = value.lastIndexOf('\n', pos - 1);
    return pos - (prevNewline + 1);
  }

  private caretIn(value: string, line: 'first' | 'last', column: number): number {
    if (line === 'first') {
      const firstNewline = value.indexOf('\n');
      const len = firstNewline < 0 ? value.length : firstNewline;
      return Math.min(column, len);
    }
    const lastNewline = value.lastIndexOf('\n');
    const start = lastNewline + 1;
    const len = value.length - start;
    return start + Math.min(column, len);
  }
}
