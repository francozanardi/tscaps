# @tscaps/engine examples

Small programs that use the engine, each one for one way of using it: three pages in the browser, a command-line render, and the runner that renders every example of the engine's README.

The examples use `@tscaps/engine` like any other npm package, through its built `dist/` files and its public entry points. So they show the setup a real project has, not the internals of this repository.

## Setup

The examples use the engine's built files. Build the engine first, then install and run from this folder:

```bash
# 1. Build the engine (one level up)
cd ..
pnpm build

# 2. Install the examples' dependencies and start the dev server
cd examples
pnpm install
pnpm dev
```

The command-line examples also need Playwright's Chromium:

```bash
pnpm exec playwright install chromium
```

## Browser examples

`pnpm dev` starts a Vite server. Its first page links to:

- **From text.** The captions come from a text box, and `PassthroughTranscriber` skips transcription. Word times are estimated from the number of characters, and the default splitters cut the text into captions. Nothing is downloaded, so this is the fastest example.
- **Transcribe.** `RenderPipelineBuilder` with every stage at its default. In-browser Whisper transcribes the audio of the clip in `input/`. The first run downloads the Whisper model.
- **CSS + alignment.** The same as Transcribe, with a stylesheet of its own and the captions at the top center.

Each page has one "Render" button. When the render ends, the browser downloads the result as an `.mp4` file.

## Command-line render

```bash
pnpm cli
```

The command:

1. Starts a Vite dev server from code.
2. Opens a headless Chromium through Playwright.
3. Loads the runner page, which has a `window.renderHeadless()` function.
4. Runs the render, catches the file the page downloads, and writes it to `output/cli-defaults.mp4`.

Use it as a starting point to run the engine from a Node program without writing your own browser page.

## The README examples

`cli/readme-runner.ts` holds every example of the engine's README as a function, with the code the README shows. `cli/render-readme-gifs.ts` runs them in a headless Chromium and writes what each one downloads to `output/`:

```bash
# Every example
npx tsx cli/render-readme-gifs.ts

# Only the ones you name
npx tsx cli/render-readme-gifs.ts renderBrollVariant renderSquarePushInVariant
```

Where the README fetches a b-roll or a music file, the runner uses `input/broll.mp4` and synthesizes the music with Web Audio. `renderWithoutCaptionsVariant` also writes a still frame as a PNG.

The README's GIFs are the first 5 seconds of those files, 220 pixels wide at 12 frames a second, through ffmpeg:

```bash
ffmpeg -t 5 -i output/readme-broll.mp4 \
  -vf "fps=12,scale=220:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" \
  ../docs/readme-broll.gif
```

The square example's GIF is `scale=220:220`. The b-roll, picture-in-picture, split-screen and no-captions GIFs start at 3 s (`-ss 3 -t 5`), so they show the clip before the layers come in and after.

## Input videos

`input/example.mp4` is the clip every example renders onto: 8 seconds, 720 × 1280, H.264 with AAC audio. To try another video, replace the file and run the example again.

`input/broll.mp4` is the b-roll the footage examples draw: a 4-second zoom into a fractal, made with ffmpeg so it looks nothing like the clip and anyone can use it.

```bash
ffmpeg -f lavfi -i "mandelbrot=size=270x480:rate=24:start_scale=3:end_scale=0.002:end_pts=96:outer=normalized_iteration_count:inner=period" \
  -t 4 -c:v libx264 -preset slow -pix_fmt yuv420p -crf 34 -movflags +faststart input/broll.mp4
```
