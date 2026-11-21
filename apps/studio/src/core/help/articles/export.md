---
title: Export the video
keywords: export, download, save video, render, burn, mp4, webm, resolution, quality, 1080p, 720p, 4k, slow export, faster export, stuck, keep tab open, file size, srt, vtt, subtitle file, transparent captions, captions only, green screen, chroma key
labels: Export, Export video, Resolution, Advanced options, Format, Quality, MP4, WebM, Low, Medium, High, Very High, Export captions instead, Subtitle file, Captions as a video, Transparent, Solid color, Include audio, Export full video instead, Slower export ahead, Continue anyway
covers: src/ui/pages/editor/features/export, src/core/export
---
Exporting draws every frame of your video with the captions, b-roll, graphics and sounds burned in, and saves the finished file to your device. It runs in your browser.

## Export your video
1. Click **Export** in the editor's top bar.
2. In **Export video**, pick the **Resolution** when there is a choice. The frame rate stays the same as your video's.
3. Optional: open **Advanced options** to choose the **Format** (**MP4** plays everywhere; **WebM** makes smaller files) and the **Quality** (**Low**, **Medium**, **High** or **Very High**).
4. Click **Export**.

When it is done, the file is saved to your device.

## Keep the tab open
The export runs in this browser tab. Keep the tab open until it finishes: the work happens in the page, so closing or reloading it stops the export.

## What makes an export faster or slower
- **Length**: every frame is drawn, so a longer video takes longer.
- **Resolution** and **Quality**: lower is faster and makes a smaller file. **Low** is the fastest.
- **Your device and browser**: a faster computer exports faster than a phone.
- **Your video's format**: if the browser cannot decode your video quickly, you see **Slower export ahead**, with ways to speed it up (convert the video, or use another browser). **Continue anyway** exports as it is.

## Export only the captions
In the export dialog, click **Export captions instead**:
- **Subtitle file**: the words and their timings as SRT, VTT, ASS, SBV or plain text, without your caption design.
- **Captions as a video**: only the animated captions, on a **Transparent** or **Solid color** background (for a chroma key in another editor), with **Include audio** if you want the sound.

**Export full video instead** brings you back.
