# tscaps

> Burn subtitles into your videos. In the browser. No upload, no account.

tscaps is a client-side video editor for captions. Drop a video in, transcribe it with in-browser Whisper, style the captions through CSS, export the result frame by frame to a new video — all without a backend.

Captions are HTML elements styled with CSS. The preview is that DOM overlaid on the `<video>`. For export, the engine rasterizes the same DOM at each frame's timestamp into a bitmap and composites it with the video frame. The browser renders the captions in both cases.

<table>
  <tr>
    <td><video src="https://github.com/user-attachments/assets/d7a3976b-28fc-4260-b92d-454197a892e0" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/f36eaec7-138f-4857-a4a8-a39b2b8d9260" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/cea91e64-1226-4ee2-9c1e-d2a3dc1b91ac" autoplay loop muted playsinline></video></td>
  </tr>
</table>

## What's in this repository

| Path | What it is |
|---|---|
| [`packages/engine`](packages/engine) | The framework-agnostic TypeScript engine that does the rendering. Published to npm as [`@tscaps/engine`](https://www.npmjs.com/package/@tscaps/engine). |
| [`apps/web`](apps/web) | The web app that wraps the engine in a UI — drop a video, edit captions, export. |
| [`templates`](templates) | The visual-style gallery the editor consumes. Each template is a folder of JSON + CSS. |

## tscaps as a hosted product

A hosted version of tscaps runs at **[tscaps.io](https://tscaps.io)** with two surfaces sharing the same editor:

- **[Local](https://tscaps.io/local)** — the same in-browser flow this repository ships. Free, private, no signup. Transcription via in-browser Whisper, hardware-bound (speed and accuracy depend on the device; mobile is rough).
- **[Cloud](https://tscaps.io)** — server-side transcription for higher accuracy and speed, AI-driven scene styling, multi-device project sync. Free tier with a watermark; paid tiers lift caps and remove the watermark.

The cloud surface's server is not open-source. What ships in this repository is the open-source equivalent of the local surface — the same editor, the same engine, the same templates, with no server in the loop. Self-host it, fork it, embed the engine in your own product.

## Run the web app

### With Docker (pre-built image)

The fastest path:

```bash
docker run -p 8080:80 ghcr.io/francozanardi/tscaps-web:latest
```

Open `http://localhost:8080`. The image is a static nginx serving the production bundle.

### With Docker (from source)

If you want to customise the build (templates, branding, environment), build the image locally. Build context is the workspace root:

```bash
docker build -f apps/web/Dockerfile -t tscaps-web .
docker run -p 8080:80 tscaps-web
```

### From source (no Docker)

```bash
pnpm install
pnpm --filter ./apps/web dev
```

Open the URL the dev server prints. Drop a video and the editor opens with the transcribe flow ready.

To produce a static bundle:

```bash
pnpm --filter ./apps/web build
```

Output lands in `apps/web/dist/`.

## Use the engine directly

The engine ships separately so you can embed it in your own product without bringing the editor UI along.

```bash
npm install @tscaps/engine
```

```ts
import { RenderPipelineBuilder } from '@tscaps/engine';

const inputVideo: Blob = /* from a file input, fetch, etc. */;

const pipeline = new RenderPipelineBuilder()
  .withInputVideo(inputVideo)
  .build();

const { blob } = await pipeline.run();
// `blob` is a Blob containing the captioned mp4
```

The full pipeline API, every styling knob, every transcriber, every splitter, the document model, and the tag system live in **[packages/engine/README.md](packages/engine/README.md)**, with worked examples and GIFs of each result.

## Templates

A template is a self-contained visual style for burned-in subtitles — a folder containing a `template.json` (metadata, controls, alignment), a `style.css` (the actual visual rules), and any assets the CSS references. The editor and the engine both pick up every folder under `templates/`; adding a new look is "drop the folder in."

The author guide — folder layout, the universal CSS variable contract that lets editor controls drive the visual, animation patterns under paused playback, SVG filters, the live-vs-export differences and traps, and an author's checklist — is in **[templates/README.md](templates/README.md)**.

If you've never written one and want to learn by reading: the existing templates under `templates/` are the canonical examples, ordered roughly by complexity.

### Contribute a template

Templates are the easiest way to leave a fingerprint on this project. The CSS contract is documented end-to-end, the existing folders are working references, and a good template can ship in a single PR with zero build-system changes. If you have a caption look you've always wanted and can write CSS, you can ship it here — and every user of the editor will see it in the gallery.

Open a PR with a new folder under `templates/` and the editor picks it up automatically.

## Document model

Every transcriber produces a `Document`. Templates style it. The hierarchy is:

```
Document
└── Section[]   contiguous run, processed by one splitter + tagger chain
    └── Segment[]   one screen-sized caption block, carries a time range
        └── Line[]   one visible line of text within a segment
            └── Word[]   a word with text, time range, and tag set
```

The render layer exposes that tree to CSS through three surfaces — a flat set of CSS classes per element, a flat set of CSS custom properties per element, and a tag system that adds more classes via taggers. Every styling decision a template makes targets one of those three surfaces.

The full description lives in [packages/engine/README.md](packages/engine/README.md#document-model).

## Project status

Pre-1.0. The public engine API is stabilising but may shift between minor versions until `1.0`. The web app is a moving target — features land regularly. Pin to an exact version (or commit) in production and review the changelog before upgrading.

## Contributing

Issues, PRs, and template contributions are welcome. The repo is a pnpm monorepo; see the per-package READMEs for run/build/test commands. New templates are especially welcome — see *Contribute a template* above.

## License

- `packages/engine` — [MIT](packages/engine/LICENSE)
- `apps/web` — [AGPL-3.0](apps/web/LICENSE)
- `templates/` — [MIT](templates/LICENSE)
