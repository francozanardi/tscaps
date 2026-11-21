---
title: Caption styles (sheets) and several looks in one video
keywords: sheet, sheets, style sheet, caption style, several styles, multiple styles, two looks, different style for some captions, hook style, peak, speaker, second speaker, per speaker color, link sheets, linked styles, copy styles, rename sheet, delete sheet, main sheet, change style sheet, assign captions
labels: Add sheet, Custom…, Change style sheet, Style sheet, Scene options, Link to…, Linked with, Unlink from group, Copy styles from…, Rename…, Reset to template default, Set hook scenes, Transcript actions, Select multiple, Scenes, Actions
covers: src/ui/pages/editor/components/sidebar/SheetSelector.tsx, src/ui/pages/editor/components/sidebar/AddSheetPopover.tsx, src/ui/pages/editor/components/sidebar/SheetSettingsPopover.tsx, src/ui/pages/editor/features/transcript/components/segments
---
A caption style, which the editor calls a sheet, is one complete look: a template plus every change you made to it. Most videos use one, named Main. Add more when some captions should look different, such as the opening hook or a second speaker.

## Where sheets are
The chips at the top of the styling tabs (**Templates**, **Typography**, **Style** and the others) are your sheets. Click a chip to switch to it: every change you make in those tabs goes to the sheet that is selected.

## Add a sheet
Click **Add sheet** (the + beside the chips). Depending on your video, the menu offers a hook sheet, a sheet for the video's key lines, one per speaker, and **Custom…** for a sheet you name and fill yourself. Delete a sheet with the x on its chip; its captions go back to Main.

## Put captions on another sheet
Open a caption's **Scene options** (the ... on its card in **Transcript**) and choose **Change style sheet**, then pick one in **Style sheet**. For many captions: **Transcript actions**, **Select multiple**, **Scenes**, click them, then **Actions** and **Change style sheet**. For the first lines of the video, **Set hook scenes** in **Transcript actions** lets you choose them.

## Link sheets so they change together
Click the selected chip (or right-click any chip) to open its options and choose **Link to…**. Linked sheets share every style change, while each keeps its own name, colour and preset; this is how speaker sheets stay alike. **Unlink from group** separates a sheet again. The link button on a chip shows what it is **Linked with**.

## Other sheet options
In a chip's options: **Rename…**, **Copy styles from…** another sheet, and **Reset to template default**, which clears every change on that sheet, including the styles of single words and captions.
