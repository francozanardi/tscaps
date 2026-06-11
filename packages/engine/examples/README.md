# @tscaps/engine examples

Four minimal consumers of the engine's render pipeline, each focused on one usage shape.

These examples consume `@tscaps/engine` as if it were any other npm package — through its public `dist/` exports — so they reflect what a real consumer's setup looks like, not the monorepo internals.

## Setup

The examples depend on the engine's built artifacts. Build the engine first, then install and run from this folder:

```bash
# 1. Build the engine (one level up)
cd ..
pnpm build

# 2. Install example deps and start the dev server
cd examples
pnpm install
pnpm dev
```

For the CLI example, also install Chromium for Playwright:

```bash
pnpm exec playwright install chromium
```

## Browser examples

`pnpm dev` opens a Vite server. The landing page links to:

- **From text** — captions come from a textarea; transcription is bypassed via `PassthroughTranscriber`. Word durations are derived from a char-count heuristic; the default segment and line splitters reformat the input into sized captions. No model download — fastest path.
- **Transcribe** — `RenderPipelineBuilder` with every slot at its default. Captions come from in-browser Whisper run over the bundled clip's audio. First run downloads the Whisper model.
- **CSS + alignment** — same as Transcribe, plus a custom stylesheet and top-center positioning.

Each example exposes a single "Render" button. When the render finishes, the browser downloads the result as `.mp4`.

## CLI example

```bash
pnpm cli
```

The CLI:

1. Starts a Vite dev server programmatically.
2. Launches Chromium via Playwright (headless).
3. Loads the runner page, which exposes `window.renderHeadless()`.
4. Triggers the render, intercepts the resulting download, and writes it to `output/cli-defaults.mp4`.

Useful when you want to bake the engine into a Node-driven workflow without writing your own browser shell.

## Input video

`input/example.mp4` is a copy of the repo's top-level `example.mp4`. Swap it for any other video by replacing the file and rerunning.
