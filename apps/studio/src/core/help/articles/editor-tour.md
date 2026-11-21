---
title: A tour of the editor
keywords: editor, layout, interface, where is, panel, sidebar, tabs, modes, transcript, timeline, preview, player, undo, redo, history, edit history, go back, checkpoint, previous version, restore, low res, export, download, start, drop video, upload, workflow, getting started, how it works, assistant, chat
labels: Drop your video here, Start your video, Start, Captions, Video, Timeline, Templates, Transcript, Typography, Style, Position, Motion, Effects, Layout, Code, Shots, Media, Audio, Undo, Redo, History, Now, Low res, Export, Show the assistant
covers: src/ui/pages/editor/components/EditorPage.tsx, src/ui/pages/editor/components/EditorToolbar.tsx, src/ui/pages/editor/components/sidebar, src/ui/pages/editor/features/preprocessing/StartDialog.tsx
---
The editor shows your video with its captions on the left and the panels that change them on the right. On a phone, the panels sit in a sheet at the bottom: drag up or down over the video, or over the tab bar at the bottom of the sheet, to make it taller or shorter, and pull down on a panel already scrolled to its top to make it shorter.

## From video to finished file
1. Drag a video onto **Drop your video here**, or click to browse your files.
2. In **Start your video**, pick the spoken language and click **Start**. The speech is turned into captions.
3. Fix the words in the **Transcript** tab.
4. Pick a look in the **Templates** tab and adjust it in the other tabs.
5. Click **Export** at the top right to make the video with the captions burned in.

## The three modes
The strip at the top of the right panel switches what the panel edits:
- **Captions**: everything about the captions. Its tabs are **Templates**, **Transcript**, **Typography**, **Style**, **Position**, **Motion**, **Effects**, **Layout** and **Code**.
- **Video**: the picture itself, with tabs such as **Shots**, **Media** and **Audio**.
- **Timeline**: the video's clock, where you cut stretches out and move words and captions in time.

## The preview
The video plays on the left with the captions drawn over it, the same way they will look in the export. Click a caption or a word in the preview to open its own style panel; drag it to move it. Right-click it for a quick menu. A **Low res** tag in the corner means the preview plays a lighter copy of your video; the export keeps full quality.

## Undo, redo and history
The arrows in the top bar are **Undo** and **Redo**; hover one to see which change it would take back or bring back. Their keyboard shortcuts are in the shortcuts article (`shortcuts`).

The **History** button next to them lists every change, newest first, with who made it (you or the assistant) and when. Click any entry to see the project as it was there; **Now** marks the one shown. Nothing gets lost: what came after stays in the list as a branch, so you can jump back to it.

