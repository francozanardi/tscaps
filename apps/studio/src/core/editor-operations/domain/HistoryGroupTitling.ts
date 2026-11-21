/**
 * Titles the checkpoints of a history group: every checkpoint made, or
 * still to be made, under `groupKey` is shown with `title`. Answers false,
 * titling nothing, when the group made no change or the title is empty.
 */
export interface HistoryGroupTitling {
  titleHistoryGroup(groupKey: string, title: string): boolean;
}
