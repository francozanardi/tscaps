# Changelog

All notable changes to `@tscaps/engine` are documented here. This file
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Prior 0.1.x releases shipped without a tracked changelog; consult the
git history for their contents.

## [Unreleased]

## [0.2.1] - 2026-07-12

### Added
- Text-behind-actor primitive: engine-level API for compositing a per-frame person-segmentation mask onto captions during export, so captions can render behind the on-screen subject.
- `Word.boundaryScore` field and a score-aware char-limit splitter that prefers natural sentence boundaries over hard character caps.
- Cuts support in the export pipeline: cuts declared on a `Document` are honored when rendering, so time ranges are removed from the output video and captions realign accordingly.
- Segment index prop on rendered segments, exposed to templates for index-based styling.
- Pause tagger.

### Changed
- Segment subtree extracted into a dedicated `SegmentSubtreeDecomposer`, and the transient `<style>` probe used for CSS variable resolution now closes deterministically.

### Fixed
- Editing a word's text or time preserves its decorations and tags instead of dropping them.
- Paint-region measurement uses inline styles so cascade-dependent metrics stay accurate.
- Removed the mutable `parent` prop from the document tree; nodes are consistently traversed top-down.
