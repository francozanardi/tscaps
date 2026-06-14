/** One contiguous edit between two strings, with half-open ranges. */
export type CharEdit =
  | { readonly type: 'keep'; readonly oldStart: number; readonly oldEnd: number; readonly newStart: number; readonly newEnd: number }
  | { readonly type: 'delete'; readonly oldStart: number; readonly oldEnd: number }
  | { readonly type: 'insert'; readonly newStart: number; readonly newEnd: number };
