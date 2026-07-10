import type { Document, Segment } from '@tscaps/engine';

interface MergeIntent {
  segmentId: string;
  text: string;
  direction: 'prev' | 'next';
}

/**
 * Restores the caret on a segment textarea after a merge or split.
 *
 * `planMergeFocus` snapshots the pre-merge state and returns a closure;
 * invoke it once the merge has committed to focus the surviving textarea
 * at the join boundary. `focusNextAfter` picks the textarea immediately
 * after the named anchor in DOM order and places the caret at its start.
 *
 * Methods no-op when no matching textarea is in the DOM.
 */
export class SegmentTextareaFocuser {
  planMergeFocus(document: Document, args: MergeIntent): () => void {
    const segments = document.getSegments();
    const idx = segments.findIndex((s) => s.id === args.segmentId);
    const partner = args.direction === 'prev' ? segments[idx - 1] : segments[idx + 1];
    if (idx < 0 || !partner) return () => {};
    const leadText = args.direction === 'prev' ? this.segmentText(partner) : args.text;
    const targetId = args.direction === 'prev' ? partner.id : args.segmentId;
    // Backspace at start of B: cursor lands right after the joiner, at the
    // start of B inside the merged text. Delete at end of A: cursor stays
    // at the end of A, before the joiner. The joiner (`\n` between lines
    // or ` ` between words) is always 1 char.
    const lead = leadText.replace(/\s+$/, '').length;
    const offset = args.direction === 'prev' ? lead + 1 : lead;
    return () => this.applyFocus(targetId, offset);
  }

  focusNextAfter(anchorId: string): void {
    const all = Array.from(
      window.document.querySelectorAll<HTMLTextAreaElement>('textarea[data-segment-id]'),
    );
    const anchorIdx = all.findIndex((ta) => ta.dataset.segmentId === anchorId);
    const next = anchorIdx >= 0 ? all[anchorIdx + 1] : undefined;
    if (!next) return;
    next.focus();
    next.setSelectionRange(0, 0);
  }

  private applyFocus(targetId: string, offset: number): void {
    const ta = window.document.querySelector<HTMLTextAreaElement>(
      `textarea[data-segment-id="${targetId}"]`,
    );
    if (!ta) return;
    ta.focus();
    const clamped = Math.min(offset, ta.value.length);
    ta.setSelectionRange(clamped, clamped);
  }

  private segmentText(seg: Segment): string {
    return seg.lines
      .map((l) => l.words.filter((w) => w.text.length > 0).map((w) => w.text).join(' '))
      .join('\n');
  }
}
