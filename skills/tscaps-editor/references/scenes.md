# Scenes drawn in code

Read this before drawing a b-roll: a few seconds of animation, written as a graphic, that takes the frame while the speaker goes on. Read the `graphics` guide first for what a graphic is and what its code is handed; this guide is the craft of a scene.

A scene is for a picture the speech paints that no photograph would show: an idea, a comparison, an "imagine if", a metaphor with something to look at. A number, or a few words to keep, is a text graphic (the `graphics` guide).

**Scenes are drawn when the person asks for them or agrees to them**, never to fill a gap (the `direction` guide). Then they are the video's b-roll, all in one style.

## The style

All the scenes of a video are drawn in one style: **chalk**, unless the person asks for another. Three others are tried: **illustrated**, **cut paper** and **pixel**, drawn on the person's word; a style they ask for outside these is drawn as they describe it, the rules below held. Within a style you are free: draw whatever tells the sentence best, and move it however shows what happens.

### Chalk

A drawing on a blackboard, made by hand while the speaker talks, as a good teacher sketches an idea, but designed: bold, simple and large, never a doodle.

- **Symbols, not characters.** A thing is reduced to the bold shape that stands for it, as a pictogram or a road sign does, and a person is a symbol of a person: a pawn (a circle over a rounded body) or a stick figure, drawn as outlines, with no face. Words in a scene are written by hand in chalk, large enough to read.
- **Coloured chalk on a dark board.** The board is near-black charcoal. Lines are thick, with round ends, and rough and broken as chalk is: the board shows through them in specks, and their edge wavers (the filter below does both; a smooth, even line reads as a marker). They are in off-white and three or four bright chalk colours: yellow, pink, sky blue and mint green. Each thing keeps its colour through every scene, and the thing that happens takes the brightest. An area is filled with hatching or a light wash of its colour, never solid.
- **Drawn by hand, and alive in the line.** Each line draws itself, in the order a hand would draw it, and once drawn it keeps its place. The line itself is alive: its grain and its edge change about eight times a second, as a line drawn again on every frame does. The drawing as a whole never shakes or moves as one, as a camera would: what moves is what the sentence moves.
- **Its way of moving**: lines drawing in, a drawn thing sliding or swinging across the board, a thing rubbed out to show it going.

The frame and a pawn in chalk, as code:

```html
<svg viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" style="display:block;width:100vw;height:100vh">
  <defs><filter id="chalk" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="wave"/>
    <feDisplacementMap in="SourceGraphic" in2="wave" scale="6" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="1" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -3.6" result="specks"/>
    <feComposite in="rough" in2="specks" operator="in"/>
  </filter></defs>
  <!-- the ground: drawn first, under a horizon at y=1340, to the bottom edge; the captions read on it -->
  <path d="M-60,1340 L1140,1340 L1140,1920 L-60,1920 Z" fill="#1b1f26"/>
  <path d="M-60,1340 L1140,1340" stroke="#ecebe4" stroke-width="9" stroke-linecap="round" filter="url(#chalk)"/>
  <!-- the subject: between y=290 and y=1340, standing on the horizon. Lines take filter="url(#chalk)",
       9 to 14 wide as they land on the frame (a scaled group takes less), stroke-linecap="round"; each path has
       pathLength="1", and draws in by its stroke-dasharray="1" and a stroke-dashoffset going from 1 to 0 -->
  <!-- a pawn, 124 wide and 240 tall, standing at 0,0, filled with the board's colour so it hides what is behind it.
       Scale it by how many there are, so they fill the width together: one or two, 3.5 to 4.5; three to five, 2.4 to 3.2; a crowd, 1.4 to 2.2 -->
  <g fill="#14171c" stroke="#7cc8f0" stroke-width="4" stroke-linecap="round" filter="url(#chalk)">
    <path pathLength="1" stroke-dasharray="1" d="M-62,0 q0,-150 62,-150 q62,0 62,150 z"/>
    <circle pathLength="1" stroke-dasharray="1" cx="0" cy="-196" r="44"/>
  </g>
</svg>
```

and the line kept alive, in the script:

```js
const noise = [...document.querySelectorAll('#chalk feTurbulence')];
tscaps.render = (t) => {
  const step = Math.floor(t * 8);
  noise.forEach((each, index) => each.setAttribute('seed', String(1 + ((step + index) % 5))));
  // ...then the scene at t
};
```

with `body` painted `#14171c`, and the viewBox in the frame's own shape.

### Illustrated

A flat vector illustration, as in a modern explainer.

- **Known at a glance.** Things are drawn with the details that make them read: a saucer has its dome and its row of lights, a planet its seas. Never a mascot, and no face on a thing.
- **Clean flat shapes, soft light.** Shapes have clean edges and soft gradients, and a glow where light comes from (a beam, a screen, a star). No outlines, no texture, nothing photographic.
- **A backdrop with depth.** A deep navy-to-violet sky or room, a far layer (stars, a skyline, a soft glow) and a near one, so the subject stands in a place.
- **Two or three bright accents** against the dark: cyan, a warm yellow, a green. The thing that happens takes the brightest.
- **Its way of moving**: things glide in, float, glow and pulse; stars twinkle; light sweeps.

### Cut paper and pixel

**Cut paper**: flat geometric shapes with no outlines and no texture, in the line of Saul Bass's title sequences and Isotype pictograms, people as pawns; a near-black ground, an off-white and two or three flat colours; a soft shadow where one shape lies over another, as paper on paper; things arrive and settle with a small overshoot. **Pixel**: squares on a grid about 135 across, six to eight flat colours, moving in steps about twelve a second; for humour and games.

## What every style keeps

- **Not the cartoon**: mascots, eyes and smiles on things, cute robots and creatures, clip-art, anything that looks drawn for children.
- **What is in front covers what is behind.** Where one thing stands before another, the one behind is hidden there: a closed shape is filled under its line, and lines never show through one another.
- **The frame has three parts, top to bottom.** Air: the top 15%, where something may arrive from. The subject: from there down to 70% of the frame's height, as wide as the frame. The ground: the bottom 30%, one large shape a shade lighter than the air (a floor, a hill, a planet's curve) that the subject stands on and overlaps. The captions read on the ground or over the subject's lower edge. The ground is part of the picture, drawn first and behind everything: never a block laid over the drawing.
- **Large in the frame, however few the shapes.** The subject, or the group, runs the width of the frame and fills most of its part of it; shapes may run off the edges. The fewer the things, the larger each one: two figures are each a third of the frame's width or more, a single thing half of it or more. Nothing is smaller than about a twentieth of the frame's width, and nothing is scattered to fill a space. Look at the middle moment: when more of the subject's part is empty than drawn, it is too small.
- **It moves the whole time, and with purpose.** Things travel, turn, grow, break, gather, change: whatever the sentence's verb is, shown as motion a viewer can follow, with the rest of the scene alive around it.

## What to draw

- **The sentence, not the topic.** Draw what this sentence says happens, with the things it names. A scene that would fit any video on the subject fits none: someone with the sound off could tell which sentence it goes with.
- **One thing happening.** A subject and one change: it arrives, grows, splits, joins, falls, fills, is covered. The change mirrors the verb of the sentence and lands on the word that says it.
- **The rest of the scene answers it.** What was already there reacts to the change as it lands: it leans away, steps aside, turns towards it, gathers. A change nothing answers looks pasted on.
- **People as simple figures.** A person is a pawn (a circle over a rounded body) or a stick figure: a stick figure when what they do needs arms or legs (pointing, shaking hands, running), a pawn when only where they stand and lean says it. Never a face.
- **A few words, written in the style.** A word or a short phrase on the board, written as the style writes (by hand in chalk), lands with what it names: a number and its label ("99%", "a tiny fraction"), the items of a list each as it is said, the word a comparison turns on ("contrast"). Words the captions already say on their own, sentence after sentence, are not written again.
- **What would be small goes over the video.** A few marks, or an icon for each thing of a list, get no ground of their own: draw them over the footage beside the speaker, in an inset box that paints no background, each landing on its word, in the same shapes and shadows.

## Time

- **The first frame is already a picture.** A scene is cut to, so at its first moment the ground and its largest shapes are there and something is moving.
- **It never stops.** While it shows, something moves: the change itself, then a float, a lean, a drift.
- **Something happens all the way through.** Plan a beat for every second or so of the scene, to its last second: a scene whose change is over by the middle and then only drifts looks still. Where the sentence has one change, let what answers it and what follows from it fill the rest (the figures turn to each other, then walk together; the sprout opens, then flowers).
- **The change lands on its word**: read the words' times (`get_transcript` with `detail: "timed"`), subtract the start of the shot the scene opens on, and time the code to them. Declare the landing with `tscaps.moment`, so a sound can go on it.
- **It lasts its sentence**, 3 to 6 seconds, and has finished what it does about a second before it ends.

## Writing it

- One SVG over the whole frame, as above, laid out `full` with `set_layer`.
- Everything from `t` alone, in `tscaps.render`, as the `graphics` guide says. Where shapes are placed by a rule (a crowd), place them once, when the code loads, from fixed numbers, never by `Math.random` inside `render`.
- A scene is cut to and from, or comes in and out with the `direction` guide's transition; it needs no entrance of its own for the frame as a whole.

The moves, as code (`k` is a 0 to 1 progress):

| Move | How |
|---|---|
| Easing out, and in and out | `1 - (1 - k) ** 4`; `k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2` |
| Settling with an overshoot | scale by `1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2` |
| Floating | add `Math.sin(t * 2 + phase) * amount` to a position, with a different `phase` for each shape |
| Leaning | `rotate` a shape a few degrees about its foot |
| Blending two colours | mix their red, green and blue by `k` and write `rgb(...)` |

## Look at it move

A scene is not done when it runs: it is done when it has been looked at across its time. `render_frames` with `strip: true` and eight to twelve moments from its first to its last gives them as one picture. Go through it for each of these, fix what fails, and look again:

1. It keeps to the video's style, as its section above says, and to what every style keeps: nothing of the cartoon, nothing showing through what stands before it.
2. The subject runs the width of the frame and fills its part of it; the ground under it is one plain shape, and the captions read on it.
3. The first moment is a picture, and each moment differs from the one before.
4. The change lands where its word is: compare the moment's time with the word's.
5. It looks like the scenes before it.
6. Someone with the sound off could say which sentence it is.
