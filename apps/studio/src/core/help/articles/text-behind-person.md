---
title: Put captions behind the person
keywords: text behind person, captions behind speaker, behind actor, behind subject, depth effect, person in front of text, occlusion, cut out, mask, segmentation, hide behind person, place behind person, keep in front, preparing your video, scan
labels: Prepare video for this template, Continue, Preparing your video…, Hide behind person, Effects, Place behind person, Keep in front, Select multiple, Scenes, Actions, Transcript, Transcript actions
covers: src/ui/pages/editor/features/person-segmentation, src/ui/pages/editor/features/element/ElementEffectsPanel.tsx, src/ui/pages/editor/features/transcript/components/bulk-mode/BulkActionsPopover.tsx
---
The person in your video can pass in front of the captions, so the text looks like it sits behind them. Finding the person runs in your browser, on your device.

## Use a template that does it
Some templates put captions behind the person on their own. When you pick one, **Prepare video for this template** asks to scan your video once: click **Continue** and wait while **Preparing your video…** runs. These templates do it only where the person is clearly and steadily in frame, so other captions stay in front.

## Put one caption, word or emoji behind the person
1. Click the caption, word or emoji in the preview.
2. In its panel, open the **Effects** tab.
3. Switch on **Hide behind person**.

On a word or emoji, only that part goes behind; the rest of the caption stays in front. Switching it off on a caption keeps it in front even where its template would put it behind. The first time, the editor needs a moment to find the person in that caption.

## Many captions at once
In **Transcript**, open **Transcript actions**, then **Select multiple** and **Scenes**. Click the captions, then **Actions** and **Place behind person** or **Keep in front**.

## When it does not work
- It never applies over a b-roll or a picture shown on top of the video: there the switch is locked.
- Some templates draw the video inside the letters, so a single word cannot go behind.
- If **Hide behind person** is missing, this template or your browser does not support it.
- The preview can pause for a moment on a caption the editor has not checked yet; it plays on once it is ready.
