---
title: Edit directly on the preview: pick, drag, resize, right-click
keywords: preview, click caption, select caption, pick word, select word, drag caption, move caption, move word, drag word, place word, resize caption, bigger captions, smaller captions, rotate, tilt, handles, right click, context menu, quick menu, inspector, snap, guides, move b-roll box, resize picture, picture in picture box, deselect
labels: Open in inspector, Edit style, Edit tags, Edit timing, Change style sheet, Hide from video, Delete scene, Add word after, Delete word, Add line break after, Affects only this scene, Edit
covers: src/ui/pages/editor/features/overlay, src/presentation/editor/controllers/OverlaySelectionController.ts, src/ui/pages/editor/features/transcript/components/words/WordPopover.tsx, src/ui/pages/editor/features/transcript/components/segments/SegmentSettingsPopover.tsx
---
The preview is not only for watching: you can pick captions, words and boxes on it, move them, resize them and open their options.

## Pick a caption or a word
Click a word in the preview to pick that word; click elsewhere on a caption (the space around its words) to pick the whole caption. A frame marks what is picked, and its own style panel opens on the right. Click empty space around the video to let go of the pick.

## Move a caption or a word
Drag a caption to move it. Guide lines show while you drag, and the caption snaps to the centre and the sides. Dragging moves every caption that shares its style sheet, since the position belongs to the sheet. To move only this caption, hold Alt (⌥ on a Mac) as you start the drag; **Affects only this scene** shows while it applies.

To place one word on its own, click it first, then drag it anywhere on the video. Drag it back over its caption to put it back in line.

## Resize or rotate
Pick a caption and drag a corner handle to make its text bigger or smaller, or the round handle to rotate it. Like moving, this changes every caption on the same style sheet unless you hold Alt as you start. A picked word has its own handles to resize or rotate just that word.

## Right-click menu
Right-click a caption or a word for a quick menu.
- On a word: change its text and timing, **Open in inspector**, **Edit style**, **Edit tags**, **Add line break after**, **Add word after**, **Delete word**, and moves to the line or caption next to it.
- Elsewhere on a caption: **Edit timing**, **Edit style**, **Change style sheet**, join with the caption before or after, **Hide from video**, **Delete scene**.

## Move or resize a b-roll, picture or graphic box
A b-roll, picture, GIF or graphic laid out as a box over the video can be picked on the preview: click it, drag inside it to move it, or drag a corner to resize it. One that fills the screen or half of it is picked from its shot instead (**Edit** on its options in the Shots tab).
