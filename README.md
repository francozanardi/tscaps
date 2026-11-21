# Tscaps

**Turn a raw talking-head video into a video for TikTok, Reels and Shorts. In your browser, by hand or with your AI agent. Free, open source, no account, no upload.**

Tscaps edits raw videos for social media. You start from a recording, usually someone talking to the camera, and end with a short video ready to post. Every edit starts from the words: tscaps transcribes the video first, with Whisper on your device, or reads its words from a subtitle file you give it. The transcript is what the rest hangs on. The captions are made of its words. The video splits into shots where sentences end. Silences are cut where nobody speaks, and sounds land on the words you put them on.

On top of animated captions, tscaps adds what a short video needs: b-roll, pictures and GIFs, animated graphics, transitions, camera moves, another shape for the frame, a colour look, music and sound effects. It works for other videos too, but this is what it is built for.

## Edit with your AI agent

Tell your coding agent what you want, and watch it edit the video in your browser. Tscaps gives Claude Code, Codex and any agent that speaks MCP the editor's own operations, and the editor opens on your screen while the agent works: every change shows as it is made, and you can undo any of it. Your video is read from your disk and exported back to it. It is never uploaded.

The agent looks at frames of the video as the export paints them, so it checks its own work before you see it. On the review screen, you correct words in the transcript and leave notes on the frame, and the agent picks them up when you press *Send to agent*.

### What one prompt does

<table>
  <tr>
    <td width="25%"><video src="https://github.com/user-attachments/assets/1ccf5243-4b1d-4624-bef6-e5e1b50e6d22" controls playsinline></video></td>
    <td width="25%"><video src="https://github.com/user-attachments/assets/67df786e-45e9-4d3f-bba0-995e7ac2ee63" controls playsinline></video></td>
    <td width="25%"><video src="https://github.com/user-attachments/assets/6148955c-6173-4ba7-bd0d-5cf523b19f33" controls playsinline></video></td>
    <td width="25%"><video src="https://github.com/user-attachments/assets/b14a7dcb-be55-46c4-896e-a10eaf29e11f" controls playsinline></video></td>
  </tr>
  <tr>
    <td><sub>"Edit this video for TikTok with dynamic captions, and make the first captions look like a poster"</sub></td>
    <td><sub>"Edit this video and add animations that explain what he says, on half of the screen"</sub></td>
    <td><sub>"Edit this video for TikTok and show the people she mentions"</sub></td>
    <td><sub>"Create a hook nobody can scroll past for this video, and add dynamic captions with the margo template. Put most of your effort into the hook"</sub></td>
  </tr>
</table>

<table>
  <tr>
    <td><video src="https://github.com/user-attachments/assets/b191190d-8a49-40e8-8a46-d42f37bda352" controls playsinline></video></td>
  </tr>
  <tr>
    <td><sub>"Edit this video for Instagram, you decide the style"</sub></td>
  </tr>
</table>

Each video is one-shot: a single prompt sent to Claude Code with Opus 5.5 at medium effort, with no follow-up messages and nothing changed by hand. The source videos were generated with AI. The portraits in the third video are public-domain pictures the agent found on Wikimedia Commons and rawpixel.

### What makes it different

- **It runs in the browser.** Transcription, editing and export all happen in a browser tab. Videos are decoded and encoded with WebCodecs. There is no FFmpeg and no server.
- **The transcript is the anchor.** Every word keeps its time. Captions, cuts, shots, b-roll and sound effects are placed on what is said, so a later cut does not move them off their words.
- **It is open all the way.** The editor, the agent's tools, transcription and export are all in this repository, and none of them needs an account.
- **It is an editor first.** You can use it without an agent: pick one of 50+ caption templates, fix a word or its timing, drag a shot. When an agent edits, you review in the same editor. Mark the frame, leave a note at that moment, and send your notes to the agent as one batch.
- **The agent is not limited to presets.** Every element is HTML and CSS, and the agent can rewrite the code of any of them, from a caption template to a single word. It can also build an element from scratch, in HTML, CSS and plain JavaScript, and animate it. Every change still goes through the editor, so you can undo it.

### Set it up

You need [Node.js](https://nodejs.org) 20 or later, and Chrome, Edge, Chromium or Brave. Connect tscaps to your agents:

```bash
npx add-mcp @tscaps/mcp -g
```

Then give your agent the [`tscaps-editor`](skills/tscaps-editor) skill, which teaches it how to edit a short video well:

```bash
npx skills add francozanardi/tscaps
```

Restart your agent, open it in the folder with your videos, and ask it to edit one.

Or let your agent do it. Paste this into it:

> Set up tscaps for me: run `npx add-mcp @tscaps/mcp -g` and `npx skills add francozanardi/tscaps`. Tell me when it is ready.

To run the server from this repository instead, run `pnpm install` and then `pnpm agent:setup` at its root. The [MCP server's README](apps/studio/mcp/README.md) has every option and the list of tools.

### A session with the agent

What working with the agent looks like, recorded as it happened: the prompt in Claude Code, the editor opening beside it, two notes left on the frame and sent to the agent, and a slide-in set by hand in the full editor.

https://github.com/user-attachments/assets/d0b57ef9-b305-4b5c-9c1f-1b89e4e03f73

<sub>Claude Code with Opus 5.5 at medium effort. The agent's work is sped up.</sub>

## Or edit by hand

The agent is one way to work, not a requirement. Tscaps is a full editor on its own: open it in your browser, drop a video, and do everything yourself with its panels and controls. Run it from this repository (see [Run the web app](#run-the-web-app)), or use the same editor at [tscaps.io/local](https://tscaps.io/local).

The editor has two layouts:

- **The full editor**: every panel, to edit everything yourself.
- **The review screen**: the video, its transcript and notes on the frame, to check what an agent did and tell it what to change.

This is the caption editor, before the Video mode existed:

https://github.com/user-attachments/assets/7ac18b8a-bb11-438c-98dc-e08d61d1a3d3

## Caption templates

Each of these is a caption template that ships in this repository. The browser rendered every one of them and exported it frame by frame.

<table>
  <tr>
    <td><video src="https://github.com/user-attachments/assets/e1aaa5f8-f06e-4018-8cdd-1e136e759ef9" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/08a92ca4-8791-4c18-8d1e-54d012038b6b" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/c17e3c5a-152e-448e-bb82-f09c98cf20e3" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/b731cdc4-9797-454f-9bb6-990e3789fa2c" autoplay loop muted playsinline></video></td>
  </tr>
  <tr>
    <td><video src="https://github.com/user-attachments/assets/b0daa473-61de-4fd1-af4d-ff34f45f77df" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/d5d2e5ff-9d76-401f-a701-be93d79407ae" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/f7a48a6b-90d4-49c4-b26b-6c88fda0ccf6" autoplay loop muted playsinline></video></td>
    <td><video src="https://github.com/user-attachments/assets/fb0f5d7c-bd35-4f9c-8d59-48c69b1cf9f6" autoplay loop muted playsinline></video></td>
  </tr>
</table>

## Features

**Captions**

- **50+ animated caption templates** in five families (Modern, Magazine, Viral, Classic, Lab). Each template has colour presets and controls for font, size, weight, colour, spacing, animation and more. CSS is there for anything the controls do not cover.
- **Word-by-word timing.** Each word has its own start and end. This gives karaoke reveals, emphasis on single words, and a style for each word.
- **Editing on the preview.** Click a word, a scene or an emoji in the preview. A panel opens with its typeface, size, weight, colour, rotation and position. Or write CSS for it.
- **Motion.** Pick how each scene enters and leaves, how its words arrive, and how its emojis move. Each animation has its own timing and easing.
- **Several styles in one video.** Give different parts of the video different looks with style sheets, for example one per speaker. Linked sheets change together.
- **Emojis and tags.** Tag words by hand for the templates to style, and add emojis above, below, around or inside the caption.
- **Text behind the person.** Captions, or single words, go behind the speaker. The person is found on your device.
- **Right-to-left and mixed scripts.** Arabic, Hebrew, Persian, Urdu and mixed-direction text follow the Unicode bidirectional algorithm.

**Video**

- **Shots.** The video is split into shots at the ends of sentences, at pauses and at cuts it already has. Split a shot at a word, join two shots, or change where one starts.
- **B-roll, pictures and GIFs** over a shot or over several shots: full screen, split screen, or in a box over the video (picture in picture), each with its own entrance and exit.
- **Graphics.** 26 animated titles, cards and calls to action. Change their text, colours and pictures in plain fields, or edit their HTML, CSS and JavaScript in the Code tab.
- **Transitions** between shots: blur, whip, spin, shake, glitch, flash, dip to white, dip to black, wipe and iris.
- **Camera moves** on a shot: slow push in, zoom, crash zoom, punch in, pans and more. Or **follow a person**: when the new shape crops the video, the camera keeps a moving speaker in the frame.
- **Other shapes.** Export in 9:16, 1:1, 4:5 or 16:9. Crop the video to fill the frame, or fit the whole video over a blurred copy or over black. The captions lay out again for the new shape.
- **Colour looks.** Warm, Cool, Vivid, Bright, Moody, Matte, Vintage and Black & white, with sliders for exposure, contrast, saturation, temperature, tint and vignette. The captions keep their own colours.
- **Cuts.** A waveform timeline where you select and cut silences or unwanted parts. Remove all the silences at once. Captions, shots and sounds follow the shorter video.

**Audio**

- **Music.** One of your own audio files under the whole video, with volume, fades, loop, and "Lower under speech" so the voice stays clear.
- **Sound effects.** 31 built-in sounds, free to use anywhere, or your own. Put one on a word, at the start or end of a shot, on a transition, on a camera move or when a layer enters or leaves. A sound stays on what it is on when you change the timing.
- **Volume** of the video's own sound, for the whole video or for each shot.

**Files**

- **In-browser transcription.** Whisper runs on your device (tiny, base, small, medium). No API key, no account, and no audio is uploaded.
- **Subtitle files in.** Start from a SubRip (`.srt`) or WebVTT (`.vtt`) file instead of transcribing.
- **Subtitle files out.** Write the captions to SRT, VTT, ASS, SBV or plain text, with per-word timing if you want it.
- **Video export.** MP4 or WebM, at the resolution and quality you pick. Or export the captions alone as a video, on transparency or on a solid colour, to use them in another video editor.
- **Projects.** Projects are saved in the browser. Export one as a `.tscaps` file and import it again later, or on another computer. The file holds your edits, not the video.
- **Undo history.** Every change is in a history you can step through, with branches when you go back and change something.

**AI agents**

- **An MCP server.** Claude Code, Codex, Cursor, Gemini CLI or any client that speaks MCP can edit a video with the editor's own operations. The editor opens in your browser, so you see every change as the agent makes it, and you can undo it. You can leave notes on the video for the agent. Nothing leaves your machine. See [Edit with your AI agent](#edit-with-your-ai-agent).
- **A skill for editing.** [`skills/tscaps-editor`](skills/tscaps-editor) teaches an agent how to edit a short video well: the hook, the pace, the captions, sound and b-roll.

**For developers**

- **Templates, graphics and motions as code.** Each caption template, graphic and layer motion is a folder of plain files that anyone can read and edit. Fork the repository and open a pull request.
- **An embeddable engine.** The engine that renders the video ships on npm as [`@tscaps/engine`](https://www.npmjs.com/package/@tscaps/engine). Use it in your own product without the editor.
- **Automation API.** Caption videos from your own code at [tscaps.io/api](https://tscaps.io/api): send a video, choose a style, and get the captioned MP4 back, rendered in the cloud.

## How it works

1. **Drop a video.** The browser reads it through the WebCodecs API.
2. **Transcribe.** Whisper runs in the browser and gives each word its own timing. The first run downloads the model (about 75 MB for the default one), and the browser keeps it after that.
3. **Edit.** Pick a template and edit the captions, then add shots, layers, sounds and a look. The preview shows captions and layers as HTML over the video.
4. **Export.** For each output frame, the engine draws the layers over the video frame, paints the captions from the same HTML, mixes the sound, and encodes the result to MP4 or WebM.

Captions and layers are HTML styled with CSS, in the preview and in the export. The browser renders them both times.

## What's in this repository

| Path | What it is |
|---|---|
| [`packages/engine`](packages/engine) | The TypeScript engine that renders the video, with no framework. Published to npm as [`@tscaps/engine`](https://www.npmjs.com/package/@tscaps/engine). |
| [`apps/studio`](apps/studio) | The web app that puts the engine in an editor: drop a video, edit it, export it. |
| [`apps/studio/mcp`](apps/studio/mcp) | The MCP server that lets an AI agent edit videos in the editor. |
| [`presets/templates`](presets/templates) | The caption templates. Each one is a folder of JSON and CSS. See [presets/templates/AUTHORING.md](presets/templates/AUTHORING.md) to write one. |
| [`presets/graphics`](presets/graphics) | The graphics a shot can show. Each one is a folder of HTML, CSS and JavaScript. See [presets/graphics/AUTHORING.md](presets/graphics/AUTHORING.md). |
| [`presets/layer`](presets/layer) | How shot layers are laid out, how they enter and leave, the camera moves and the transitions. |
| [`skills`](skills) | Skills for AI agents: [`tscaps-editor`](skills/tscaps-editor) for editing a video with the MCP server, and [`tscaps-api`](skills/tscaps-api) for captioning videos through the Tscaps API. |

## Tscaps as a hosted product

A hosted version runs at **[tscaps.io](https://tscaps.io)**, with the same editor:

- **[Local](https://tscaps.io/local).** The same in-browser editor this repository ships. Free, no sign-up, Whisper in the browser. Its speed depends on your device.
- **[Cloud](https://tscaps.io).** Transcription on a server (faster and more accurate), AI styling, an assistant that edits the project from requests in plain words (with an account), and projects that open on any device. The free plan includes 2 videos a month without a watermark. Paid plans remove the watermark and raise the limits.
- **[Automation API](https://tscaps.io/api).** Caption videos from your own code. Send a video, pick a template, and get the video back with animated captions.

The cloud server is not open source. This repository is the open-source counterpart of the local version: the same editor, engine and templates, with no server involved. Host it yourself, fork it, or use the engine in your own product.

## Run the web app

### With Docker (pre-built image)

The fastest way:

```bash
docker run -p 8080:80 ghcr.io/francozanardi/tscaps-web:latest
```

Open `http://localhost:8080`. The image is nginx serving the production build as static files.

### With Docker (from source)

To change the build (templates, branding, environment), build the image yourself. The build context is the root of the repository:

```bash
docker build -f apps/studio/Dockerfile -t tscaps-web .
docker run -p 8080:80 tscaps-web
```

### From source (no Docker)

```bash
pnpm install
pnpm --filter ./apps/studio dev
```

Open the URL the dev server prints, and drop a video.

To produce a static bundle:

```bash
pnpm --filter ./apps/studio build
```

The files are written to `apps/studio/dist/`.

## Use the engine directly

The engine ships on its own, so you can use it in your own product without the editor.

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
// `blob` is the MP4 file with the captions in its pixels.
```

The same builder adds b-roll and pictures over the video, music and sound effects, a colour grade, another frame shape and cuts. **[packages/engine/README.md](packages/engine/README.md)** has every option, with examples and GIFs of each result.

## Templates

A template is one look for the captions: a folder with a `template.json` (metadata, controls, alignment), a `style.scss` (the visual rules) and, if needed, a `filters.svg`. The stylesheet is Sass, so a template can use the shared helpers in `presets/templates/_lib/`. A build step compiles it to a flat `style.build.css`, which is the file the editor reads. Nothing is resolved at runtime, so anyone who knows CSS can read and edit the result.

The author guide is **[presets/templates/AUTHORING.md](presets/templates/AUTHORING.md)**. It builds a template from nothing, one step at a time. The reference (the full `template.json` schema, the CSS variables, animation patterns, the helper library, SVG filters, the differences between the preview and the export, and the author's checklist) is in **[presets/templates/_docs/](presets/templates/_docs)**.

To learn by reading, open the templates in `presets/templates/`: they are the examples.

### Contribute a template or a graphic

Templates and graphics are the easiest way to contribute. Their contracts are documented from end to end, the existing folders are working examples, and one pull request can add one without any change to the build.

Open a pull request with a new folder under `presets/templates/` or `presets/graphics/`, and the editor picks it up. Graphics follow [presets/graphics/AUTHORING.md](presets/graphics/AUTHORING.md).

## Document model

Every transcriber produces a `Document`, and the templates style it. Its structure is:

```
Document
└── Section[]   contiguous run, processed by one splitter + tagger chain
    └── Segment[]   one screen-sized caption block, carries a time range
        └── Line[]   one visible line of text within a segment
            └── Word[]   a word with text, time range, and tag set
```

The renderer shows that tree to CSS in three ways: CSS classes on each element, CSS custom properties on each element, and tags, which add more classes. Every rule in a template targets one of these.

The full description is in [packages/engine/README.md](packages/engine/README.md#document-model).

## How tscaps compares

Tscaps sits between closed caption editors and desktop video editors. This table is coarse on purpose, and other products change: check each one for what it does today.

|  | tscaps (this repository) | tscaps.io cloud | Closed caption editors | Desktop video editors |
|---|---|---|---|---|
| Runs in your browser | Yes | Yes | Most | No |
| Video stays on your device | Yes | No | No | Yes |
| Open source | Yes | No | No | No |
| Free, no watermark | Yes | 2 videos a month without a watermark on the free plan | Free use is watermarked | Varies |
| Account required | No | Not for a few videos | Yes | No |
| Animated caption templates | 50+, in CSS you can edit | The same, with AI styling | A fixed list | Few |
| Edit a template's CSS | Yes | Yes | No | No |
| A style for each word and scene | Yes | Yes | Limited | Keyframes by hand |
| Shots, b-roll, transitions, camera moves | Yes | Yes | Some | Yes |
| Music and sound effects | Yes | Yes | Some | Yes |
| Cuts on a timeline | Yes | Yes | Some | Yes |
| Text behind the person | Yes, on your device | Yes, on your device | No | Masking by hand |
| Transcription | Whisper on your device | On a server (faster) | On a server | Varies |
| Several speakers | By hand | Automatic, or by hand | Automatic | By hand |
| AI styling | No | Yes | Yes | No |
| SRT / VTT import | Yes | Yes | Yes | Yes |
| Subtitle file export | SRT, VTT, ASS, SBV, TXT | The same | Some | Yes |
| Embeddable engine on npm | Yes | Not applicable | No | No |
| Mobile app | No (the web app works on phones) | The same | Some | Some |

**A framework, not a list of presets.** Closed tools give you a fixed list of looks. Tscaps gives you templates you can read, edit and extend, with controls on top and CSS for everything else.

## FAQ

**Does tscaps upload my video anywhere?**
Not in this build. The video never leaves the browser, and the MCP server reads it from your disk and writes the export back to your disk. The hosted [tscaps.io](https://tscaps.io) cloud sends the audio track to a server for transcription, and stores the projects you save while signed in. To use nothing but your own device, use [tscaps.io/local](https://tscaps.io/local) or host this repository yourself.

**How accurate is the in-browser transcription?**
It depends on the model and the device. Tscaps has four Whisper models: tiny, base, small and medium. On a laptop, small is a good default. A recent desktop runs medium well. Phones are slow. When accuracy or speed matters, the cloud transcription at tscaps.io is faster and more accurate.

**Which video formats can I open?**
Anything the browser's WebCodecs API can decode: MP4 (H.264), WebM (VP8, VP9, AV1), MOV. Where the browser cannot read an HEVC (H.265) video, as on many Windows computers, the editor can convert it on your device first. This conversion is experimental. Rotated videos work.

**Can I start from an SRT or VTT file?**
Yes. Choose "Use subtitle file instead" when you start a video. Each caption keeps the file's timing.

**Can I add music, b-roll or sound effects?**
Yes. The Video mode splits the video into shots. Each shot can have b-roll, pictures, GIFs, graphics, a camera move and a transition. Its Audio tab sets the music and the volume, and sound effects go on words, shots, layers and transitions.

**Can an AI agent edit videos with it?**
Yes, through the MCP server in `apps/studio/mcp`. It works with Claude Code, Codex and any client that speaks MCP. The agent edits in the editor in your browser, so you see and can undo every change. See [Edit with your AI agent](#edit-with-your-ai-agent).

**Do I need to know CSS?**
No. The editor has controls for font, size, weight, colour, spacing, animation, and the look of each element. CSS is there for anything the controls do not cover, but you can make a whole video without opening it.

**Can I write my own caption template or graphic?**
Yes. A template is a folder with `template.json` (metadata and editor controls) and `style.scss` (the visual rules). See [presets/templates/AUTHORING.md](presets/templates/AUTHORING.md) for a step-by-step guide and [presets/templates/_docs/](presets/templates/_docs) for the reference. A graphic is a folder of HTML, CSS and JavaScript: see [presets/graphics/AUTHORING.md](presets/graphics/AUTHORING.md). You can also save a graphic you changed in the editor as a preset of your own.

**Is this the same code as tscaps.io/local?**
Almost. Both run the same editor on the same engine, with two differences. First, tscaps.io/local shows some features as locked, with a link to the cloud version. This repository leaves those features out, so nothing in the editor mentions the hosted product. Second, tscaps.io/local sends anonymous usage events. This repository has no telemetry.

**Does it work on mobile?**
The editor opens on phones. Whisper transcription is slow there: a 60-second clip can take a few minutes on a mid-range phone, and the export is slower too. On phones, [tscaps.io](https://tscaps.io) transcribes on a server.

**Why put the captions in the pixels instead of a subtitle track?**
Two reasons. First, a subtitle track needs a player that shows it. TikTok, Reels, Shorts and muted autoplay ignore subtitle tracks, but captions in the pixels show everywhere. Second, tscaps captions are animated (word-by-word reveals, emphasis on single words, keyframe transitions), and subtitle formats cannot hold that.

**Can I host this on my own server?**
Yes. The Docker image `ghcr.io/francozanardi/tscaps-web:latest` is a static build, ready to serve. See *Run the web app* above.

**Can I use the engine in my own product?**
Yes. `@tscaps/engine` on npm is a TypeScript package with no framework. See [packages/engine/README.md](packages/engine/README.md).

**Which browsers work?**
Chrome 94+, Edge 94+, Safari 16.4+ and Firefox 130+.

**What is the license?**
The engine, the presets and the skills are MIT. The editor app is AGPL-3.0. See below.

## Project status

Pre-1.0. The engine's public API can still change between minor versions until 1.0. The web app changes often, and new features arrive regularly. Pin an exact version (or commit) in production, and read the changelog before you upgrade.

## Contributing

Issues, pull requests, templates and graphics are welcome. The repository is a pnpm monorepo, and each package's README has its run, build and test commands. New templates and graphics are especially welcome: see *Contribute a template or a graphic* above.

This project is tested with BrowserStack.

## License

The repository is [AGPL-3.0](LICENSE), except for the folders that carry their own MIT license:

- `packages/engine`: [MIT](packages/engine/LICENSE)
- `presets/`: [MIT](presets/LICENSE)
- `skills/`: [MIT](skills/LICENSE)

`apps/studio` is [AGPL-3.0](apps/studio/LICENSE).
