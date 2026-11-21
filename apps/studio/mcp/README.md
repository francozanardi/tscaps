# tscaps MCP server

Lets a coding agent you already run (Claude Code, Codex, Cursor, Gemini CLI, or any client that speaks MCP over
stdio) edit videos with tscaps: open a video and its captions, run the editor's own operations, look at frames
painted exactly as the export paints them, move through the history, and export the video to disk.

The agent does not edit a hidden copy. The server serves the editor on `127.0.0.1` and opens it in your browser,
so every change the agent makes shows there as it makes it, and you can change anything yourself, undo the agent's
work, or tell it what to fix before anything is exported. Nothing leaves your machine: the video is read from disk
by the page, and the export is written back to disk.

The page opens on a review: the video, the transcript (fix a misheard word right there), and tools on the frame to
comment on what you click or draw on it. Your notes go to the agent together when you press *Send to agent*; it
reads them with `request_review`, makes the changes, and resolves the notes it did. *Open full editor* gives you every
panel of the editor, and *Review* brings you back.

## How it works

```
your agent ──MCP over stdio──> tscaps MCP server (Node)
                                 ├─ serves the built editor and your files on 127.0.0.1, behind a session token
                                 ├─ opens the editor in a new window of Chrome, Edge, Chromium or Brave
                                 │  (headless when there is no screen, or with --headless)
                                 └─ sends each call to the page over server-sent events; the page answers with POSTs
```

The page runs the same code you use when you open the editor yourself: the same operations its panels call, the
same history, the same export. A tool call is never a second implementation of what the editor does.

## Run it

From npm, with nothing to clone or build. Connect the server to your agents (it asks which ones):

```bash
npx add-mcp @tscaps/mcp -g
```

And give them the editing skill:

```bash
npx skills add francozanardi/tscaps
```

The package [`@tscaps/mcp`](https://www.npmjs.com/package/@tscaps/mcp) carries the built editor and the server as one
script; its command is `npx -y @tscaps/mcp`, for an agent you add it to by hand. It is published with every release
of the editor, at the editor's version.

Then restart your agent, so it loads the server, and open it in the folder that holds your videos: the server reads
and writes files only under its working directory and the folders you add with `--root`.

### From this repository

To run the server from a checkout, after `pnpm install`, at the root of the repository:

```bash
pnpm agent:setup
```

It builds the editor, downloads the browser it needs, lists the editor's operations, registers the server with
Claude Code and Codex where their command lines are installed, and installs the `tscaps-editor` skill for both
(`~/.claude/skills` for Claude Code, `~/.agents/skills` for Codex). Run it again after you pull a new version. From
this folder (`apps/studio`), the same command is `pnpm mcp:setup`; `--skip-build` keeps the current build.

### By hand

For another client, or to see each step, build the editor once, from this folder (`apps/studio`):

```bash
pnpm install
pnpm build
pnpm mcp:operations
```

`mcp:operations` and `--headless` run Playwright's Chromium, as does the server where it finds no Chrome, Edge,
Chromium or Brave: download it once with `pnpm exec playwright install chromium`.

`mcp:operations` opens the built editor in a headless browser once, lists its operations, and writes them beside the
build (`dist/mcp-operations.json`), so the server can offer each operation as a tool of its own. Run it again after
every build: a build empties `dist`. Without a build or without the list, the server offers your agent one tool,
`finish_setup`, that says what to run; restart the server once it ran.

Then add the server to your agent. Claude Code:

```bash
claude mcp add --scope user tscaps -- /path/to/apps/studio/node_modules/.bin/tsx --tsconfig /path/to/apps/studio/tsconfig.mcp.json /path/to/apps/studio/mcp/main.ts
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.tscaps]
command = "/path/to/apps/studio/node_modules/.bin/tsx"
args = ["--tsconfig", "/path/to/apps/studio/tsconfig.mcp.json", "/path/to/apps/studio/mcp/main.ts"]
```

For the editing craft as well as the tools, give your agent the skill too: copy `skills/tscaps-editor/` (at the
root of this repository) into the folder it loads skills from (`~/.claude/skills/` for Claude Code). The guides are
the skill's references: an agent that loads no skills gets the tools and the server's instructions only.

### Options

| Option | What it does |
|---|---|
| `--root <folder>` | Another folder the server may read videos from and write exports to. Repeatable. |
| `--headless` | Never show the page: a headless browser, for a machine with no screen or a run nobody watches. |
| `--browser <path>` | The browser to open the page in, instead of the one found. |
| `--browser-arg <arg>` | An argument added to that browser's command line. Repeatable. |
| `--dist <folder>` | Where the built editor is. Defaults to `../dist` next to this folder. |
| `--editor <route>` | The editor's route under the build's base path. Defaults to `editor`. |

## Tools

| Tool | What it does |
|---|---|
| `open_video` | Opens a video, with its captions from an SRT, VTT or JSON file of word timings, or transcribed in the browser by the Whisper model it names (`small` by default). |
| `wait_for_job` | Waits for an `open_video` or `export_video` that takes longer than a tool call. |
| `get_status` | What the editor shows now: the project, its video, any error. |
| One tool per operation (`get_project`, `get_transcript`, `set_caption_typography`, `add_graphic`, `set_framing`, `cut_video`…) | The editor's operations, with their own descriptions and input schemas. Each edit is a checkpoint you can undo; edits run under one `checkpoint` key make one. |
| `render_frames` | Pictures of the output at chosen moments, painted as the export paints them, also written as PNG files; `region` zooms on a part. |
| `reframe_video` | Makes the video another shape and frames every shot on what it should show. The editor finds the takes and the people in each and frames by measure; your agent only says whom a take with several people shows, from one picture of the takes with the people lettered, in one call. |
| `add_media`, `look_at_media` | Puts a file from disk in the project's media bin (b-roll, a GIF, a sound or music), and shows what files in the bin look like. |
| `save_template`, `save_graphic_preset` | Keeps a caption style or a graphic as your own, for any project. |
| `search_help` | The editor's help: how to do something in it by hand, what a part of it is. |
| `request_review`, `resolve_notes` | The notes you leave on the video and send from the page (*Send to agent*), as your agent reads them, with a picture of each marked moment; and removing the ones it did. |
| `title_checkpoint`, `list_checkpoints`, `move_in_history` | Name the agent's changes, read the history, undo, redo, go back to a checkpoint. |
| `save_project` | Writes the project as a `.tscaps` file. |
| `export_video` | Exports the video to a file, through the editor's own export. |

## Develop

Tests run with the editor's (`pnpm test`); typecheck and lint cover this folder too (`pnpm typecheck`, `pnpm lint`).
`pnpm mcp` starts the server from this folder.

`pnpm mcp:package`, after `pnpm build` and `pnpm mcp:operations`, writes the npm package to `mcp-package/`: the
server bundled into `bin/tscaps-mcp.mjs` (Vite's build for Node, every dependency inlined except `playwright-core`)
and the built editor in `dist/` beside it, with `package-readme.md` as its README.
