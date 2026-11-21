# @tscaps/mcp

Let your coding agent edit videos with [tscaps](https://github.com/francozanardi/tscaps). This MCP server opens the tscaps editor in your browser and gives your agent the editor's own operations: captions, cuts, shots, b-roll, graphics, camera moves, colour, music and sound effects. You see every change as the agent makes it, and you can undo any of it.

Your video is read from your disk and exported back to it. It is never uploaded. Your agent uses its own model.

## Set it up

Add the server to your agents. This asks which ones, among Claude Code, Codex, Cursor, Gemini CLI, VS Code and others:

```bash
npx add-mcp @tscaps/mcp -g
```

Give your agent the `tscaps-editor` skill, which teaches it how to edit a short video well:

```bash
npx skills add francozanardi/tscaps --skill tscaps-editor
```

Restart your agent, open it in the folder that holds your videos, and ask it to edit one.

You need [Node.js](https://nodejs.org) 20 or later, and Chrome, Edge, Chromium or Brave.

## By hand

To add the server to an agent yourself, give it this command:

```bash
npx -y @tscaps/mcp
```

For example, in Claude Code:

```bash
claude mcp add --scope user tscaps -- npx -y @tscaps/mcp
```

The server reads and writes files only in the folder the agent starts in, and in the folders you add with `--root`.

## Options

| Option | What it does |
|---|---|
| `--root <folder>` | Another folder the server may read videos from and write exports to. Repeatable. |
| `--headless` | Never show the page: a headless browser, for a machine with no screen or a run nobody watches. |
| `--browser <path>` | The browser to open the page in, instead of the one found. |
| `--browser-arg <arg>` | An argument added to that browser's command line. Repeatable. |

The tools the server offers, and how it works, are in the [server's README](https://github.com/francozanardi/tscaps/tree/main/apps/studio/mcp#readme).

## License

AGPL-3.0. The editor this package carries is the open-source tscaps editor.
