# Changelog

All notable changes to the tscaps web app are documented here. This file
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The engine (`@tscaps/engine`) is versioned separately; see its own release
notes on npm.

## [Unreleased]

### Added
- Edit several scenes or words at once from the desktop transcript. Change their style, move scenes to another sheet, place them behind the person, edit word tags, or delete the selection.
- Choose separate fonts for the alphabets used in your captions. The preview and export use the same choices, and old projects are upgraded when they open.
- Two caption templates: Sol, with handwritten accents and a coloured glow; and Nova, with bold two-line captions and six colour variants.

### Changed
- A scene's timeline menu opens on the first press and now includes Redistribute. The timeline also works when the transcript is empty.
- The word tag menu shows only tags the current template styles.
- Exports with long cuts are much faster because removed sections of the video are skipped instead of decoded.
- Removed "Group scenes by rule" from the transcript menu.

### Fixed
- First-run transcription no longer depends on an external host for its runtime files. Model downloads can also use a configured `VITE_MODEL_RELAY` when their normal host is blocked.
- Exports no longer fail on iPhone or iPad when the browser stops reading the originally selected file. The app keeps another copy during the edit and asks for the file again only when no readable copy remains.
- Opening a saved project with missing video data now asks you to select the file again. A project that is genuinely absent says so instead of suggesting a reload.
- A failed export shows its error on the first attempt instead of requiring a second press of Export.
- Adding or joining scenes around cuts no longer places them inside removed video, deletes scenes hidden by a cut, or fails when every existing scene is cut.
- A playable video is no longer rejected just because the browser cannot create the optional fast preview. If the browser cannot export it either, the export dialog says so before rendering begins.
- Videos are no longer rejected as damaged just because the player could not read their duration. Files the browser cannot access now get a separate message.
- Firefox no longer offers Theo because its exports render with artifacts there.

## [0.3.0] - 2026-08-30

### Added
- Five more templates: Enzo, Hugo, Sara, Lewis and Pastor. Thirty-six in the gallery now. Pastor is the first template that asks for its captions to sit behind the speaker.
- The template gallery is grouped into families: Modern, Key moments, Viral, Classic and Lab. Two of them show a short clip playing over real footage instead of a still swatch, because their look either composes against the video or lives in what it does with the words over time.
- Colour presets on most templates. The Preset field in the Style tab used to appear on four templates and now appears on twenty-four. The first preset is the look the template already ships with, so nothing you picked before looks different until you choose another.
- Add a Hook or a Peak sheet from the "+" beside the sheet chips. Each one is offered only when your transcript holds words that belong on it, so the button never creates an empty sheet.
- Reset a whole sheet to its template default, from the sheet chip's menu. One step reseeds every tab at once, typography, style, layout, effects, motion and your own CSS, and clears the edits you made on individual words and scenes under that sheet.
- Captions that sit behind the speaker are measured while you work, with no dialog to wait behind. The measurement covers only the stretches captions occupy, runs a piece at a time starting from where you are, and fills in a stretch it had never looked at when you move a caption there. Playback pauses only when it reaches one of those, and a finished pass reports how many scenes it will lift.
- The language list in the start dialog is ordered by what you are likely to want: the ones you pick most, the one you picked last, the ones your browser and your timezone suggest, then a popular set, then the rest alphabetically.
- A warning before a long video is transcribed in the browser, past ten minutes on a computer and past two on a phone. Speed and accuracy there depend on the device, and a long video on a weak one is a long wait.
- The projects list takes a video dropped anywhere on it, and each card carries the video's length and a menu for renaming and deleting.
- A Support panel behind the heart button in the toolbar, listing the ways to help the project: share it, star the repository, leave a review, send feedback, or donate.

### Changed
- Captions break at the width they really render at. The arithmetic behind the line breaks counted a space between every pair of words that captions never have, spent letter spacing everywhere except after the last letter, and read a single typeface for every word whatever size the template gave it. Measured against the same words laid out by a browser, it was running eight to eleven percent over. A line now holds about a tenth more, and every template's width was retuned against the corrected number. The default width is narrower as well, so a full line stays clear of the action rail that the short-form players draw down the right edge.
- Changing a template clears every hand edit under that sheet. Edits on words and decorations used to survive, keyed to values the new template knows nothing about, so they rendered as nothing at all or as noise you could not find and undo. Returning one scene to the automatic decision about sitting behind the speaker is part of that same step now, and the scene menu keeps one switch rather than two that read as two ways to do the same thing.
- Preparing the preview stops once it is no longer worth the wait. How long a video takes to prepare depends on the machine and on how the video was recorded, and the old limit tried to predict that from the file alone. It turned away long videos that would have been quick, and it kept you waiting on short ones that were not. The preparation is now timed while it runs and stopped when it passes what the video earns: around twenty seconds for a one minute video, rising to ninety for ten minutes or longer. One that is clearly going to run over is dropped in the first few seconds instead of at the end. When it stops, your video plays right away, and you can ask for the precise preview whenever you want from the timeline.
- Opening a saved project no longer prepares its preview again. A project you had opened without one used to repeat the whole preparation every single time.
- Exports redraw the captions only when they change. Three things stood in the way. Any style that draws its outline with an SVG filter was redrawn from scratch on every frame, including the long stretches where nothing on screen moves. The drawing was done in fixed chunks of frames, so the same caption came back around to be drawn again a few frames later even when nothing about it had changed. And the styles that read the video's own pixels, the frosted ones and the ones that blend, were redrawn once per frame no matter what. A caption that holds still is now drawn once and reused for as long as it holds still, which is where the saving is largest: exports at high resolution, where each drawing is the expensive part, and phones, where one of those pixel-reading styles took 160 seconds and now takes 59. Styles whose effect genuinely changes every frame, like the one that flickers, redraw exactly as before.
- Exporting no longer waits for the project to be saved. The save ran before anything appeared on screen, so over a slow connection that was twenty seconds of nothing at all. It runs alongside the render now, and it is skipped when nothing has changed since the last one.
- The Highlight tag is now called Peak. Fourteen templates already use "highlight" for the word being spoken right now, and the tag means something else: the closed phrases a video is built around. A template styling `.highlight` for the tag needs `.peak`, and kel's `tag-bg-color` control is now `peak-bg-color`. Projects saved before this are converted when you open them.

### Fixed
- Safari opens videos that have sound. Safari before version 26 ships only the video half of the toolkit the app checks for, so every video with an audio track was refused a moment after you dropped it. The check now asks for the audio half only on the paths that actually decode audio, and transcription falls back to the browser's older audio decoder where the newer one is missing. That fallback also handles long videos: it used to read the whole soundtrack at once, which ran a phone out of memory on anything past a few minutes, and now works through it a minute at a time.
- A video the browser genuinely cannot open no longer suggests converting a file that is already MP4. When both attempts at reading the audio failed, only the first was reported, so the advice named the wrong problem.
- A caption whose movement lives in a decoration is no longer exported as a still image. The export decided whether a caption was moving by reading the caption itself, which cannot see an animation attached to a shape drawn beside it. Pepper's growing pill is the one that showed it: it played in the preview and was a still image in the exported file.
- Typing your first caption into an empty transcript paints it on the video. A video with no speech opens with nothing in the transcript, and the first scene added to it landed under no style sheet at all, so the words read back correctly in the transcript panel while the video stayed bare.
- A full disk no longer costs you the project. Reading a project was also writing a timestamp, and a browser with no room left refuses every write, so opening any project failed with no message and sent you back to the list. Alongside that: a video you re-select is attached even when it cannot be kept, and a full disk now reports once instead of twice with two notices that said nearly the same thing.
- A preset survives a template change. Twenty-four of the thirty-six templates ship presets and the rest ship none, so passing through one of those collapsed your choice permanently, with no error and no way back.
- A control a template gained after you saved a project reaches that project. The value was missing rather than set to its default, so the control did nothing at all. Fonts are where it showed: the exported video fell back to a system typeface while the preview looked right.
- Fixing a typo no longer removes the gap-free padding from the scene.
- Sentences and clauses break correctly in Arabic, Persian, Urdu, Chinese, Japanese and Korean. The splitter looked only for the punctuation Latin scripts write.
- A Hook or Peak sheet reads in the project's own direction. Both arrived left to right inside a right-to-left project, which puts the closing full stop at the wrong end of the line.
- Cancelling the prepare-video dialog takes the template back. It used to leave the sheet on a template that needs captions behind the speaker with no measurement to support it, so the effect you picked never appeared. And hiding one scene behind the speaker by hand no longer removes the offer to measure the whole video, which it did permanently, reloads included.
- Captions in Russian, Ukrainian, Serbian, Greek or Hindi land on a typeface the style chose. Most of the heavy display faces caption work starts from carry no letters for those alphabets, so those captions were drawn in whatever your device happened to supply, which differs from one machine to the next and matches nothing the style intended. Each style now names a stand in for them that carries its own voice, the way the Arabic and Hebrew ones already did.
- The fast preview notice claimed everything worked without a prepared preview. Styles that place captions behind the speaker cannot play until it is ready, and the notice says so now.
- Transcription in the Docker image runs on every core instead of one. The image was serving the app without the two headers a browser wants before it will hand a page shared memory, and the speech model falls back to a single thread without them. On one machine that was 20 seconds of inference on a video that takes 13. Chrome and Firefox pick this up; Safari does not implement the header it rests on, and stays as it was.

## [0.2.1] - 2026-08-14

### Fixed
- In-browser transcription no longer fails the moment the speech model finishes downloading. The published build was resolving an older inference runtime than the current model weights can be read by, so the session never opened.

## [0.2.0] - 2026-08-14

### Added
- Style one element on its own. Click a word, a scene or an emoji in the preview and a panel opens over the editor with that element's own typeface, size, weight, colour, rotation and place in the frame. Setting a field further out takes it back from everything inside, so painting a whole caption yellow reaches the word you had made blue. Beside the fields is the CSS they write, editable: anything the fields do not cover, you write yourself, and a field whose declaration your own line has taken over dims and says so rather than pretending to still be in charge.
- Pick how the captions move. A Motion tab offers a grid of drawn cards for each part: how a scene enters, how its words arrive one after another, how its emojis do. Picking one plays that element's own stretch of the video so you see the choice rather than read its name, and pressing the chosen card again replays it. Answer for the one element you picked, or for a whole style sheet at once, in which case every caption under it follows. The card selected when the tab opens is the entrance the template already applies, so you see what you have before replacing it, and a template whose look does not survive being animated locks the panel and says why.
- Where an animation has something worth dragging, its controls sit beside it. A distance, a direction, a duration, an overshoot, a swing, whichever the animation you picked actually has.
- Editing a style sheet's own CSS now warns about `!important`. In a template stylesheet it is not a strong rule but an unreachable one, and it silently switches off every control the editor offers for that template, the colour picker and the size slider included.
- Style the opening scenes of your video as a hook. In the transcript's scene actions menu (the wand icon), "Set hook scenes" lets you click through the first scenes to mark them; they move to a Hook sheet with its own template, style and effects, and go back to Main when you clear the selection.
- Export the captions as a subtitle file, to carry them into another editor. "Export subtitles instead" at the bottom of the export dialog writes SubRip (`.srt`), WebVTT (`.vtt`), Advanced SubStation Alpha (`.ass`), SubViewer (`.sbv`), or the plain transcript as `.txt`. Cut sections are accounted for, so the file lines up with the video you export from the same project, and the text comes from your transcript, so punctuation and capitalization are there even when the style you picked drops them from the captions on screen. An optional word-level timing switch times each word rather than each phrase; the dialog says what that costs in the format you picked, since some carry it inside a normal entry and others can only reach it by making the file several times longer. Your caption design stays in tscaps: these formats carry text and timing, not the look.
- Right-to-left captions. Arabic, Hebrew, Persian and Urdu now read in the correct order instead of coming out word-reversed, in the preview and in the exported video alike. The direction is picked from your transcript when the video is transcribed, and a Direction field at the bottom of the Typography tab lets you change it. Persian, Hebrew and Urdu joined the language list in the start dialog.
- Linked sheets: tie two or more sheets into a group so a single style edit (font, size, template, effects) rides across every sibling while each keeps its own preset. Multi-speaker projects link all speaker sheets by default. Unlink or relink from the chain icon on each sheet chip.
- Group scenes by tag: the "Group scenes" dialog can now send every word carrying a chosen tag (number, quote, emphasis, and the rest) to a sheet at once. Only the tagged words move, splitting into their own scenes on the target sheet; the surrounding words stay where they are. A toast reports how many scenes or tagged words moved.

### Changed
- The style controls speak one vocabulary across the gallery. The same knob now carries the same name, unit and range whichever template you are on, and a few that had been doing two jobs at once were split apart, so tuning a template's shadow no longer recolours its outline. Your saved projects carry their tuning across.
- Style controls are split into a Style tab and a Motion tab. Anything that is only about movement renders beside the animation it moves rather than among the colours. The single "Animation intensity" slider that some templates shipped is gone, replaced by the animation's own controls: it could only make one movement bigger or smaller, and there is now something finer to reach for.
- Changing a template keeps the work you did on individual words. It used to clear every word's size, colour and position along with the scenes'. Only the scenes' styling goes now, which is what changing the look of the captions is about.
- Bringing a VTT file keeps the word timings it already carries. WebVTT can mark when each word is spoken, and those marks used to be thrown away and the timings guessed from how long each word is to write. A file that carries them now lands its captions exactly where it says, which matters for the word-by-word styles.
- Local (in-browser) transcription is much faster and shows a real progress bar throughout. It uses multiple CPU threads when the browser allows, runs on smaller model weights that download about 4× faster and infer noticeably quicker without a meaningful accuracy drop, and reports actual progress during transcription instead of an indeterminate spinner. Audio extraction uses less memory on long videos, streaming the audio out of the file track by track instead of loading the whole video into the browser's audio decoder at once. A new Medium option in Advanced trades a longer first-run download for higher accuracy. When your browser genuinely can't decode a video's audio, the message now says so and suggests converting to MP4 (H.264 + AAC).

### Fixed
- The speech model is kept between sessions. A browser that refuses to store it left every later session downloading it again with nothing on screen saying why. It now downloads once, and when it genuinely cannot be kept a notice says so and tells a full disk apart from a private window.
- The selection outline follows what it frames. Resizing a word from its panel left the outline at the box the word had when you picked it, and a caption playing its entrance slid out from under its own outline.
- Clicking the space around a word selects the scene again. A click that missed every word snapped to the nearest one from much too far away: measured, that was swallowing 87 to 92 percent of the area around a line, leaving the scene barely pickable. The reach now only grows where a word is genuinely too small to hit, which is what it was there for.
- A caption nearly as wide as the video can be moved. It snapped to a side guide at every position it could reach, pulled right when you asked it to go left, and could not be pushed out of frame at all. A caption now hangs at most half out of frame on any side and never goes missing.
- In-browser transcription no longer fills longer videos with duplicate lines or looping filler phrases. On videos past about half a minute the speech model would sometimes transcribe the same stretch of audio twice at window boundaries, or get stuck repeating a short phrase ("like, oh, I'm going to be, like, oh…") until it ran out of budget. Both landed verbatim in your transcript, and both are now caught and dropped before they reach the editor.
- Scene tails now follow your edits in both directions. If Gap-free was on, each transcript edit added another second to every scene's tail, so after a dozen edits scenes were hanging on screen several seconds after the speech had stopped. And once a scene had stretched, nothing pulled it back in: moving a later scene's first word earlier left the scene before it still covering that word. Padding now settles at one second past the last word and gives the room back as soon as there is less of it.
- A scene time you set by hand is no longer lost when you retime a word. Editing any word inside the scene wiped the start and end you had chosen and snapped the scene back to its words.
- Kel no longer shifts the line sideways as it plays. The word being narrated switched to a heavier weight, which takes a different width under any font other than Kel's own, pushing every word after it along.
- Running out of browser storage no longer costs you the transcription you just waited for. Preview preparation falls back to the original video, and a failed save shows a notice you can dismiss instead of blocking export behind an error that never cleared.
- Transcription can be retried after the speech model fails to download. A dropped connection used to leave it broken for the rest of the session, behind a message that suggested trying a shorter video.
- The start dialog no longer sits on "Analyzing video" forever with files that don't declare their length (common with screen recordings and fragmented MP4). The length is now read from the video data itself, and if the file truly can't be read, a message says so and suggests re-exporting it as MP4.
- Videos without an audio track now open the editor with an empty transcript so you can add captions by hand, instead of failing with a transcription error. The start dialog warns upfront that there is no speech to transcribe.
- Videos your browser can't actually decode (common with HEVC / iPhone footage) now fail right after the drop, with advice to convert to MP4, instead of minutes later after transcription already ran.
- The editor no longer hangs on "Loading project" when the preview can't open the project's video. A dialog explains what happened and leads back to your projects.
- Cuts panel no longer reveals the transcript and audio waveforms out of sync. A spinner shows while audio is analyzed, and both appear together once ready.

## [0.1.3] - 2026-07-13

### Fixed
- The Docker image now mounts the app correctly. Previously the container served a blank page because the router basename didn't match the served path.
- Loading caption reads "Opening" instead of "Downloading project video" — the previous wording overstated what happens when a project is read from browser storage.

## [0.1.2] - 2026-07-12

### Fixed
- Docker image builds no longer require network access to `api.nuget.org`. The `onnxruntime-node` native postinstall (which downloads a Linux/GPU binary the browser bundle never uses) is skipped, so builds succeed on runners that cannot reach NuGet.

## [0.1.1] - 2026-07-12

First tagged release. Everything below has landed since the last rolling `:latest` push.

### Added
- Hide text behind person: captions render behind the on-screen subject, with live preview, per-segment override, and a prepare-video step when a template needs the effect. Runs entirely in the browser.
- Cuts module: automatic silence removal, resizable cut spans, transcript syncs with cuts, cuts respected in preview and export.
- Mobile playback keeps the screen awake, bottom-sheet resize is refined, and timeline drag feels better on touch.
- Preview video player rebuilt on a canvas surface with WebCodecs decode. This gives higher precision at the frame level, which is required by features like cuts. The native `<video>` player is still available via `VITE_PREVIEW_SURFACE=native` as a fallback.
- Preprocessing stage now generates a video proxy in 480p for the preview. It is useful for other features like *hide text behind person*. It can be disabled with `VITE_PREVIEW_PROXY_ENABLED=false`.
- Emojis effect: decorate captions with emojis.

### Fixed
- Editor video box sizes against the actual column height so aspect ratio holds through layout changes.
- Blocked IndexedDB upgrades surface a dialog instead of hanging.

## [0.0.1] - 2026-06-11

Initial public preview. This entry documents the state of the rolling `:latest` image at its first export, before the project used semver tags. It is included for reference and was never published as a tag.

tscaps is a client-side video editor for burning subtitles into video, running fully in the browser with no backend and no upload.

### Added
- In-browser transcription via WebGPU Whisper, with model-size fallback for low-end devices and a warning for mobile.
- HTML + CSS caption engine: templates author captions as styled DOM, rasterized per frame through SVG `foreignObject` for export.
- MediaBunny-backed export pipeline with configurable resolution and bitrate, service-worker streaming to disk for large exports, and pre-export font collection.
- Overlay editing on the preview: click-to-select segments and words, drag to move, resize handles, and rotation gestures — all commit as per-word / per-segment overrides.
- Captions / transcript editor: edit word text and timings, split into graphemes, split and join lines, find current scene, keyboard navigation, undo/redo across text inputs.
- Style sheets: multiple caption styles per project, per-scene assignment, sheet matchers, multi-speaker templates, and per-segment / per-word style overrides.
- Templates system with a bundled catalog, categories, favorites, JSON + CSS authoring, control fields (typography, colors, layout, effects, SVG filters with CSS vars), custom font uploads, and an assets library.
- Effects: gap-free, remove-punctuation, boundary-aware segment splitter, balanced-line splitter, scaled-character splitter, dynamic sizing.
- Video-frame layer for templates whose visuals depend on the underlying pixels (frosted glass, blend modes).
- Mobile-friendly layout: resizable panels, simplified captions editor, OS theme detection.
- Self-contained Docker image for running the editor locally.
