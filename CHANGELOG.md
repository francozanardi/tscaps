# Changelog

All notable changes to the tscaps web app are documented here. This file
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The engine (`@tscaps/engine`) is versioned separately; see its own release
notes on npm.

## [Unreleased]

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
