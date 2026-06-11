import type { EditorStore } from '@core/editor/store/EditorStore';
import type { SegmentStyleOverrides } from '@core/editor/domain/SegmentStyleOverrides';

const STYLE_FIELDS: readonly (keyof SegmentStyleOverrides)[] = [
  'fontWeight', 'italic', 'underline', 'strikethrough', 'fontFamily', 'fontSize', 'color', 'verticalOffset', 'horizontalOffset', 'rotation',
];

export class SetSegmentStyleOverrideAction {
  constructor(private readonly store: EditorStore) {}

  /**
   * Commits per-segment overrides with an undo entry coalesced by the set
   * of fields that actually changed vs. the previous overrides — a rapid
   * slider drag (only `position` differs each tick) collapses into a
   * single history step instead of flooding the stack.
   */
  execute(segmentId: string, overrides: SegmentStyleOverrides): void {
    const current = this.store.snapshot().segmentOverrides;
    const previous = current.getStyle(segmentId);
    const next = current.withStyle(segmentId, overrides);
    const changed = STYLE_FIELDS.filter((k) => previous[k] !== overrides[k]);
    const key = changed.length > 0
      ? `segmentStyleOverride:${segmentId}:${changed.join(',')}`
      : undefined;
    this.store.commit(key);
    this.store.patch({ segmentOverrides: next });
  }
}
