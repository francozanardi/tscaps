---
title: Edit history: go back to any earlier version
keywords: history, edit history, checkpoint, checkpoints, version, versions, earlier version, previous version, go back, restore, revert, rollback, undo many, undo several, lost changes, branch, redo, jump back, what changed, who changed, assistant changes, saved version
labels: History, Undo, Redo, Now, Saved, Go back to before this, Bring back, Not in the project now
covers: src/ui/pages/editor/features/history, src/core/editor/store/CheckpointHistory.ts
---
Every change to a project, yours or the assistant's, becomes a checkpoint in the edit history. You can go back to any of them without losing the others.

## Go back to an earlier version
1. In the editor's top bar, click **History** (the clock button next to **Undo** and **Redo**).
2. The list shows every checkpoint, newest first: what changed, who made it (You or Assistant) and when. Hover an entry to see every edit it holds.
3. Click an entry. The project shows as it was right after that change, and **Now** marks it. **Saved** marks the version that was last saved.

To return, open **History** again and click the entry you came from.

## Nothing gets lost
Going back does not delete anything. If you make a new change after going back, the history splits: your new change starts a new branch, and the changes it replaced stay in the list as another branch, drawn as a line beside it. Click any of them to jump there.

The history lasts while the project is open in the editor. It is not saved with the project, so reopening a project starts a new list.
