# Templates

This folder is the gallery of caption looks the tscaps editor ships with. Each subfolder is one template: a typography choice, colour palette, animation style, and the set of knobs the editor exposes to the user when that template is active.

The editor loads every folder under `templates/` automatically. If you want to add a new look — or contribute one back — drop a folder in here.

## What a template is

A template is three files:

```
templates/<name>/
├── template.json   metadata, default typography, style knobs, layout
├── style.css       the actual visual rules
└── filters.svg     optional — SVG <filter> declarations for advanced effects
```

`template.json` declares the template's identity (name, default font, alignment, the colour pickers and sliders the editor shows when this template is active). `style.css` paints the captions. `filters.svg` is only needed if the template reaches for SVG filter primitives (directional blur, displacement, lighting).

Shared binary assets (PNG masks, SVG textures) live in [`_assets/`](_assets) and are referenced from any template's CSS with `url('asset:<filename-without-ext>')`.

## A worked example

[`juno/`](juno) is a small template worth reading end-to-end before authoring your own.

Its `style.css`:

```css
.segment {
  font-family: var(--tscaps-font-family, 'Bungee'), sans-serif;
  font-weight: var(--tscaps-font-weight, 400);
  font-style: var(--tscaps-font-style, italic);
  font-size: var(--tscaps-font-size, 3.91cqh);
  text-transform: var(--tscaps-text-transform, uppercase);
  text-align: var(--tscaps-text-align, center);
  color: var(--tscaps-primary-color, #ffffff);
  animation: juno-pop-in 0.35s var(--on-segment-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.word {
  display: inline-block;
  margin: 0 var(--tscaps-word-spacing, 0.12em);
  text-shadow:
    calc(0.04em * var(--tscaps-shadow-depth, 1)) calc(0.04em * var(--tscaps-shadow-depth, 1)) 0 var(--tscaps-shadow-color, #000),
    calc(0.08em * var(--tscaps-shadow-depth, 1)) calc(0.08em * var(--tscaps-shadow-depth, 1)) 0 var(--tscaps-shadow-color, #000);
}

.word-being-narrated {
  color: var(--tscaps-highlight-color, #ffdd00);
}

@keyframes juno-pop-in {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.10); }
  100% { transform: scale(1); }
}
```

A few load-bearing things to notice:

- **The typography knobs and the template's own style controls reach CSS as variables.** Font family, weight, style, size, alignment, the colour pickers, the shadow-depth slider — these arrive as `var(--tscaps-<id>, <fallback>)`. The fallback is what renders when the user resets the control. Other knobs (alignment within the video, segment / line splitters, effects) live in `template.json` and tell the engine how to lay out and group captions — they don't pass through CSS.
- **Per-frame state classes mark where the playhead is.** As the playhead moves, the engine attaches one of `…-not-narrated-yet`, `…-being-narrated`, `…-already-narrated` to every `.word` and every `.line`, swapping them at element boundaries. The active-word highlight in this template just styles `.word-being-narrated`, but anything the same selectors can target — colour, transform, filter, animation — works on lines too.
- **The pop-in is anchored to the segment start, not to wall-clock time.** `animation-delay: var(--on-segment-starts)` is what pins the animation to the narration timeline. The engine pauses every animation and walks the keyframes by adjusting the delay each frame, so playback is frame-accurate in both the live preview and the exported video.

Those three ideas — variable-driven controls, per-frame state classes, narration-anchored animations — are most of what writing a template comes down to. [`AUTHORING.md`](AUTHORING.md) is the full reference: the complete `template.json` schema, every CSS variable the editor and the engine emit, every animation pattern with its trade-offs, the SVG filter contract, the live-vs-export differences, and an author's checklist.

## Adding your own

1. Create `templates/<your-name>/` and drop a `template.json` and a `style.css` in it.
2. Start by copying an existing template that's visually close to what you want, then iterate.
3. The dev server picks up new templates on the next reload. The editor's "Templates" panel surfaces every folder under `templates/`.

If the template needs an SVG filter, add a `filters.svg`. If it needs an image asset, drop it in `_assets/` and reference it as `url('asset:<filename-without-ext>')` from any template that needs it.

## Authoring with an LLM

A template is small, self-contained, and the contract is fully documented in a single file. That makes it a good fit for LLM-assisted authoring. Paste [`AUTHORING.md`](AUTHORING.md) into a coding agent (Codex, Claude Code, Cursor) as context, then describe the look you want ("uppercase, neon outline, chromatic shake on the active word"). The agent has the full `template.json` schema, every CSS variable, every animation pattern, and every gotcha right in its context window, and can produce a working template you only need to tune.

## Contributing

Templates are the most direct way to leave a mark on this project. The CSS contract is small, the existing folders are working references, the build system needs no changes, and a good template can ship in a single PR. If you have a caption look in mind and can write CSS, the path from idea to shipped is short.

To contribute: open a PR with a new folder under `templates/<your-name>/`. Include a one-line description of the look in the PR body, and a short clip showing the template on a real video if you have one handy — it makes review faster and the contribution easier to celebrate.

Issues and improvements to existing templates are welcome too.

## License

Templates in this folder are MIT-licensed. Contributions are accepted under the same licence so every template in the gallery is freely redistributable and modifiable.
