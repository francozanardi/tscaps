# Animations on captions and layers

## Prefer presets

`set_element_animation` with a preset keeps the editor's panels in sync and is always correct:

- Caption presets (`list_catalog` with `caption_animations`): `fade-in`, `rise-in`, `slide-in`, `scale-in`, `pop-in`, `snap-in`, `wobble-in` on every caption kind; `flash-in`, `smear-in` on words.
- Scopes: on a segment, `self` (the caption as a whole), `words` (each word in turn), `emojis`; on a line, `self` and `words`; on a word or an emoji, `self`. On a layer, `entrance` and `exit`.
- Each preset's fields (`params`), with their ranges and defaults, come with `list_catalog`.

Write keyframes yourself only for what the presets do not do.

## How the editor plays animations

Every frame is drawn by pausing every animation and seeking it through its `animation-delay`. So an animation only moves if its delay is tied to the playhead with one of the editor's clocks; without one it holds its first frame forever.

| Element | Starts | Ends | Length |
|---|---|---|---|
| segment | `var(--on-segment-starts)` | `var(--on-segment-ends)` | `var(--segment-duration)` |
| line | `var(--on-line-being-narrated-starts)` | `var(--on-line-being-narrated-ends)` | `var(--line-being-narrated-duration)` |
| word, emoji | `var(--on-word-being-narrated-starts)` | `var(--on-word-being-narrated-ends)` | `var(--word-being-narrated-duration)` |
| layer | `var(--on-layer-starts)` | `var(--on-layer-ends)` | `var(--layer-duration)` |

## Patterns

- **Entrance**, on the element itself:
  `animation: rise 0.4s var(--on-segment-starts) cubic-bezier(0.22, 1, 0.36, 1) both;`
- **While it is said** (karaoke), with `0%` and `100%` equal to the resting look:
  `animation: say var(--word-being-narrated-duration) var(--on-word-being-narrated-starts) ease-in-out both;`
- **A pop when a word is said** (resting look at both ends, so the word shows normally before and after):
  ```css
  animation: pop 0.35s var(--on-word-being-narrated-starts) cubic-bezier(0.22, 1, 0.36, 1) both;
  @keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
  ```
- **Exit** as the caption leaves: delay `calc(var(--on-segment-ends) - 0.25s)`.
- **Stagger** words from a segment: `& :where(.word) { animation: rise 0.3s calc(var(--on-segment-starts) + var(--word-index) * 0.06s) ease-out both; }`
- **Loops** work (`infinite`) when the delay reads a clock.

## Traps

- `from` (or `0%`) shows from the moment the caption mounts until the delay: an entrance whose `from` is hidden keeps the element hidden until its moment, which is what you want for an entrance and wrong for an emphasis. An emphasis starts and ends on the resting look.
- Two animations on one caption element fight: the later one's `from` wins every property both animate. Use one animation, or put the second on a child (`& :where(.line)`), or keep their properties apart.
- A look you declare only inside keyframes disappears when another animation replaces yours: declare it on the element too.
- Your `animation` replaces the template's on that element. `animation: none` removes the element's own motion (its parent's motion still carries it).
- `transition` never shows in the export. Use keyframes on a clock.
- Animate `transform`, `opacity`, `color`, `filter`, `text-shadow`. Animating a custom property jumps in steps.
