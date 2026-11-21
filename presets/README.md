# Presets

What a user picks from, kept as files: written by hand, compiled by `pnpm --filter ./apps/studio presets:build`
(which the install runs) and read by the editor. Published whole with the open-source build, under MIT.

| Folder | What it holds |
|---|---|
| [`templates/`](templates/) | The caption looks: one folder per template (`template.json`, `style.scss`, `filters.svg`), the Sass library they share (`_lib/`, including the captions' entrances in `_lib/animation/`), the shared assets (`_assets/`) and the authoring guide ([AUTHORING.md](templates/AUTHORING.md), [`_docs/`](templates/_docs/)) |
| [`graphics/`](graphics/) | The graphics a shot can show: one folder per preset (`graphic.html`, `graphic.css`, `graphic.js`, `preset.json`), written by the rules in [AUTHORING.md](graphics/AUTHORING.md), which is also the format a language model writes one in. Read as they are, with no build |
| [`layer/`](layer/) | What belongs to shot layers: [`stage/`](layer/stage/), the layout framework every layer's box is built by and the transitions between shots; [`animation/`](layer/animation/), the motions a layer comes in and leaves with and the moves of a camera, a list of their own (`presets.scss`) whose primitives `@use` the captions' `declared` |

Built files (`*.build.*`) sit beside their sources and are gitignored.
