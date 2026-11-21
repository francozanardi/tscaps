---
title: Subtitle files (SRT, VTT) in and out
keywords: srt, vtt, webvtt, subrip, ass, sbv, txt, subtitle file, captions file, closed captions, download subtitles, export subtitles, import srt, upload srt, use my own subtitles, existing subtitles, transcript text, plain text, word timing, karaoke, premiere, davinci, capcut, youtube captions, transparent captions video
labels: Export, Export captions instead, Subtitle file, Format, Advanced options, Word-level timing, Download, Captions as a video, Start your video, Use subtitle file instead, Transcribe instead, Start
covers: src/ui/pages/editor/features/export/components/OtherExportFormats.tsx, src/ui/pages/editor/features/export/components/SubtitleExportSettings.tsx, src/ui/pages/editor/features/preprocessing/StartDialog.tsx
---
You can download your captions as a subtitle file to use in other apps, and, when transcription runs in your browser, start a video from a subtitle file you already have.

## Download your captions as SRT, VTT or text
1. Click **Export** at the top right.
2. At the bottom of the dialog, click **Export captions instead**.
3. Choose **Subtitle file**.
4. Pick a **Format**: SubRip (.srt), WebVTT (.vtt), Advanced SubStation Alpha (.ass), SubViewer (.sbv) or Plain text (.txt).
5. Click **Download**.

The file holds your corrected words and timings, with cuts applied and hidden captions left out. It does not carry your caption design: fonts, colours and animation stay in tscaps.

## Time every word in the file
In the subtitle export, open **Advanced options** and switch on **Word-level timing**. Some formats handle this compactly; in SRT it makes a much longer file, with one entry per word. Plain text has no timings.

## Keep the design: captions as a video
To use the animated captions in another editor, choose **Captions as a video** instead of **Subtitle file**. It makes a video of the captions alone, on a transparent or solid background, to lay over your footage.

## Start from your own SRT or VTT file
When transcription runs in your browser, the **Start your video** dialog offers **Use subtitle file instead**. Click it, pick your .srt or .vtt file and click **Start**: the captions come from the file and nothing is transcribed. Word timings are estimated from each line, so word-by-word animations may not match the voice exactly. **Transcribe instead** goes back to transcription.
