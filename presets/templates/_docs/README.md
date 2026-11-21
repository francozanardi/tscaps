# Template reference

The deep reference for template authoring. Start with the guide at
[../AUTHORING.md](../AUTHORING.md) — it builds a template step by step and links here where
each subject gets deep.

| File | Covers |
|---|---|
| [template-json.md](template-json.md) | Every field of `template.json`: identity, typography defaults, placement, splitters, effects, style controls, variants, feature opt-outs, rendering switches |
| [css-contract.md](css-contract.md) | What the runtime publishes to CSS: the element tree, state classes, structure tags, timing variables, structural metadata, letter mode, right-to-left, cascade layers, shared assets |
| [style-controls.md](style-controls.md) | How a knob reaches your CSS: the universal typography set, unit conventions, the three ways to declare a control, the catalogue, groups, what the build refuses |
| [animation.md](animation.md) | The frozen-frame model, the four patterns, declaring what you apply, the fifteen library recipes, the entrances a user can pick, per-animation fields |
| [library.md](library.md) | The Sass build and every primitive: `segment-typography`, `word-layout`, `fitted-line`, `soft-drop-shadow`, `dynamic-font-size`, `control.field` |
| [filters.md](filters.md) | `filters.svg`: which outline to use, file shape, filter regions, variable substitution, recipes, why SMIL is refused, cross-browser notes |
| [rendering.md](rendering.md) | Where preview and export differ, the video-frame layer, text behind the actor, how the line splitter measures |
| [browser-support.md](browser-support.md) | What Safari, Firefox and Windows get wrong, the workaround for each, `unsupportedBrowsers`, and why each template that opts out does |
| [checklist.md](checklist.md) | Everything to verify before opening a PR |

The folder name starts with `_` so the build does not read it as a template.
