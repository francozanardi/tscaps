# Writing CSS in this editor

Captions are HTML styled with CSS, drawn the same way in the preview and in the exported video. A caption element's colour, font, size, weight, italic, underline, rotation and own place are set with `set_caption_element_style`, as the inspector does: CSS is for what no field covers. Three places take CSS:

| Target | What you write | Tool |
|---|---|---|
| One caption element: a segment (a caption on screen), a line, a word, an emoji | Declarations for the element itself, plus nested rules for its parts | `set_element_css` |
| A layer (b-roll, picture, GIF, a graphic's box) or a shot's own video (`shot:N`) | Declarations for the box (geometry, transform, opacity...) | `set_element_css` |
| A caption style as a whole | The whole template stylesheet, replaced | `set_sheet_css` (rarely; prefer style controls) |

`set_element_css` replaces the element's whole CSS, what its fields and animations wrote included. Read it first with `get_element` and keep what you do not mean to change; a write over CSS that changed since you last read or wrote it (a field or an animation set since, an edit by the person) is refused, with the CSS as it is now, so you can write again on top of it: the blocks an animation preset wrote come first, and editing them makes the editor treat that animation as hand-written.

## Caption elements

- Write declarations at the top level; they apply to the element. Use native nesting for the rest:
  - `&.word-being-narrated { ... }` the element in a state (no space after `&`),
  - `& :where(.word) { ... }` its words (always through `:where()`, so a word's own CSS still wins),
  - `&::before { ... }`, and `@keyframes` anywhere in the text.
- Never write `!important`, `@import`, `@font-face`, `@media`, `@layer`, `:hover`, `transition`, `position: fixed`, `vw` or `vh`.
- Sizes in `em` (they follow the caption's font size). Never `px` for shadows or moves.
- On a segment or a line, a plain `color` or `font-size` loses to the template's rules on words: use `& :where(.word)`.
- Styling a segment pins its current split into lines (it stops reflowing with its neighbours).
- Caption style changes (`set_template`) wipe every element's own CSS under that style: pick the template first, then style elements.

### What the editor puts on captions

- Markup: `.segment > .line > .word`, with the emoji in `.word-decoration` (by default placed in `.segment-decorations-below`, outside the word: reach it with `& :where(.word-decoration)`).
- State classes, exactly one at a time on each word and each line: `word-not-narrated-yet`, `word-being-narrated`, `word-already-narrated` (and `line-...` for lines).
- Position classes: `first-word-in-line`, `last-word-in-line`, `first-word-in-segment`, `last-word-in-segment`, `first-line-in-segment`, `last-line-in-segment`, `segment-after-pause`.
- Tags on words (set with `edit_words`): `number`, `quote`, `emphasis`, `accent`, `peak`, `hook`, `entity`, `cta`, `superlative`, `stat`. A tag changes nothing by itself: only a caption style that selects it gives it a look (many style `.emphasis, .accent, .entity` as one highlighted family, some none). `edit_words` warns when the style ignores a tag; then give those words a look with `set_element_css`.
- `behind-actor-active` is on a segment while it is drawn behind the person.
- Counters you can read with `var()`: `--word-index` (position in its line), `--word-count`, `--segment-index`, `--word-char-count`, `--line-char-count`.
- Never select `[data-tscaps-el=...]`, `data-tscaps-*` ids or `tscaps-render-*` classes yourself.

### Fonts

Name one of tscaps' fonts exactly, or the export can differ: `font-family: 'Anton', sans-serif`. Inter Variable, Montserrat Variable, Poppins, Bricolage Grotesque Variable, Anton, Bebas Neue, Oswald Variable, Playfair Display Variable, Fraunces Variable, EB Garamond Variable, Caveat Variable. For any other, its weights, or another alphabet: the `fonts` guide.

### Effects

- `text-shadow`, `-webkit-text-stroke`, `background` with `border-radius` and `padding` (for pills and boxes), `transform`, `rotate`, `filter: blur() drop-shadow() hue-rotate()` all work.
- `filter: url(#id)` only works with the filters the sheet has (`set_sheet_css` `filtersSvg`).
- Do not outline emojis. For blending with the video use `set_caption_element_effects`, not `mix-blend-mode`.
- A highlight behind the spoken word without changing its size:
  ```css
  isolation: isolate;
  & :where(.word) { position: relative; }
  & :where(.word-being-narrated)::before {
    content: ""; position: absolute; inset: -0.1em -0.18em;
    background: #2563eb; border-radius: 0.12em; z-index: -1;
  }
  ```
- A state class must not change the word's size (no `font-size`, `font-weight`, `letter-spacing`, `padding` on `.word-being-narrated`): the line would jump. Use colour, background, shadow, transform or an absolute `::before`.

## Layers and a shot's own video

A layer is drawn as a box over the frame. Only these draw: `left`, `top`, `width`, `height` (and `inset`, `margin`), `transform`, `translate`, `rotate`, `scale`, `transform-origin`, `opacity`, `filter: blur()` and `brightness()`, `clip-path: inset()`, `border-radius`, `object-fit` and `object-position`. Nothing else (no `color`, `background`, `box-shadow`, `border`, `z-index`). Units: `cqw`, `cqh`, `cqmin` (shares of the frame) or `%` of the box; never `em`.

- Place layers with `set_layer` (layout full, split or inset), not with CSS: the editor's panels read those settings.
- Motions of a layer go through `set_element_animation` (entrance, exit); in CSS publish your own through `--layer-entrance-animation` and `--layer-exit-animation` (never set `animation` itself on a layer: it replaces the transitions and the camera). The layer's clock: `--on-layer-starts`, `--on-layer-ends`, `--layer-duration`.
- A shot's own video (`shot:N`) takes the same CSS: `scale: -1 1;` mirrors it, `filter: brightness(1.15)` brightens it.

## Checking

The tool answers warnings for CSS that will not draw as written. Then look: `render_frames` at a moment the element is on screen.
