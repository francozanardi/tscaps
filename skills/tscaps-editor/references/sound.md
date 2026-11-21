# Sound effects

Read this before adding a sound effect. In an edit of the whole video, the `direction` guide's card for the video's tone says which sounds and how many: take them from there. A graphic preset, a camera move or a caption template that brings its own sounds keeps them.

A sound effect marks something new appearing on screen: an emoji popping in, a graphic or a title coming in, a number landing, a b-roll cutting in, a key line revealed. It makes what the viewer sees land harder. A wrong one, or one too loud, makes the edit worse than no sound at all. So every sound has a job, tied to what appears at that instant, and plays under the voice.

## Where a sound goes

- **On something that appears.** Emojis and graphics are the best places: each appears at its own instant, and the sound lands with it. Then a title or a sticker coming in, a b-roll cutting in, a key line revealed.
- **Appears means it was hidden and comes on screen**, not that it is said. A caption shows its words before they are spoken: a word said while it is already on screen appears nowhere, and a sound there lands on nothing new. Not on the key word of a line as it is said, not on a punchline as it is said, not on every caption.
- **On a word only when the telling counts out a beat**: each item of a ranking or a list as the speaker names it ("in fifth place", "fourth"...), a countdown, the answer to a question kept back. The same sound on each, on the word that says it.
- **Nothing appears where a sound would fit?** Leave it silent, or offer to add the emoji, the graphic or the zoom that would give it a reason.

## Which sound: what usually works

These are recommendations, not rules: what tends to sound right on short videos. A good way to see a sound effect is as the sound of an action an animation makes on screen: something slides in, pops in, is revealed. Where nothing animates, a sound usually has nothing to mark.

- **Something moves in: a whoosh or a swish** usually fits. Something entering with a move, sliding or flying in (or leaving the same way): a picture, a text, an emoji, a b-roll, a graphic. Match the sound to the move: a short, snappy move takes a `swish`, or `swish-heavy` for weight; a longer slide a `whoosh-soft`, or `whoosh-fast` for a quick one. A thing that only fades in has no move for it to match, so a softer sound or none fits it better. Look at how it comes in before choosing (`render_frames` just after it appears, or its entrance).
- **Something pops in place: a pop**, for rhythm. Something appearing with a pop-in or scale-in animation rather than a move across the frame: an emoji, a picture, a sticker. `pop-mouth`, or `pop-punchy` on a playful video. What slides in usually takes a whoosh instead.
- **A key line or word revealed: a click** (`click`) sets it apart. Text that matters, hidden until it comes on screen, usually also set apart in its style, subtly (bold, italic, another font, bigger), and brought in with a quick, subtle entrance: quick because it happens while the speaker talks, and a slow one would lag behind the voice. Kept for the few lines that carry the video. The sound goes where the text is revealed, which depends on how its captions come in:
  - a caption that comes in whole: when the caption comes in, its start (`get_transcript` with `detail: "timed"` gives each caption's `startSec`; `at: { sec }` on it). A word of that caption was already on screen when it is said, so a click on that word marks nothing;
  - captions revealed line by line: when the line comes in, which is when it starts to be said (`at: { word }` on its first word);
  - captions revealed word by word: when the word comes in, as it is said (`at: { word }` on it).

## The jobs

| What happens | Sound | Where it goes |
|---|---|---|
| A title or a text graphic comes in with a move | a `swish` or `swish-heavy` for a short move, a `whoosh-soft` or `whoosh-fast` for a longer slide | the layer's entry: `at: { layer }` |
| A number or a key word lands hard in a graphic | `pop-punchy`, or `swish-heavy` when it slams in with a move | the graphic's landing moment: `at: { layer, moment }` (`add_graphic` answers its moments) |
| A word is underlined or swept with a marker | `marker-swipe`; circled: `marker-circle` | the graphic's moment (hook presets bring their own) |
| An emoji or a sticker pops in | `pop-mouth`, `pop-punchy` | the emoji itself, `at: { decoration }`, silent while it does not show; a sticker's layer entry |
| An emoji, a picture or a text slides in | `whoosh-soft`, `whoosh-fast`, `swish` | the emoji itself, `at: { decoration }`; the layer's entry |
| A key line or word revealed, set apart | `click` | where it is revealed: the caption's start, the line's first word, or the word, as its captions come in |
| A transition, a cut into b-roll | `whoosh-soft`, `whoosh-fast`, `swish` | the shot's start (transitions bring their own) |
| A reveal after a build-up | `riser-short` or `riser-hit`, ending exactly on the reveal | ending on what reveals it (a graphic's moment, the emoji), or on the word that tells it when the speaker kept it back |
| A list counted out, a countdown | a light pop (`pop-mouth`), the same on each | each number's word as it is said, or each tick's moment in a graphic |
| Text being typed on screen | `typing-short` | the layer's entry, or a typed key line's first word |

Prefer the sounds this guide names. `list_catalog` with `sounds` says what each one sounds like and suits. A sound on a graphic's moment moves with the graphic: put it there rather than on a time.

## Never

- **On every caption, on cuts, on words as they are said**: a word on screen before it is spoken is nothing new, and a sound per caption is noise. A key line revealed is the exception, and a rare one.
- **On a punch-in**: a punch-in is a cut, not a move. A fast zoom move brings its own whoosh; keep it only when the move should be heard.
- **A happy sound on bad news**: no chime, bell, glass or pluck on a loss, a failure, a sad or angry line. Those are for a win, a right answer, a tick.
- **A riser that lands on nothing**: it must end on the reveal.
- **Two sounds less than two seconds apart**, unless one is the landing of the other (a riser into its hit). When several things appear close together (emojis in captions that follow each other, a graphic and an emoji), give the sound to the one that matters most and leave the others silent: four pops in a row is noise, not four moments. `add_sounds` warns about a sound placed too close to another: one of the two usually sounds better, unless the person asked for both, and then their ask comes first. Either way, leave each sound on what it marks rather than nudging it (`offsetSec`) to clear the warning. One sound per graphic: a whoosh when it slides in, or a pop when it pops in, not both.
- **Louder than the voice.** Leave `volume` out: each sound already plays at the level that sits it under the voice, and a sound set louder comes back with a warning.

## Tone

- Match the video's tone: the `direction` guide's card names the sounds each tone takes. No cartoon sounds (`pop-bloop`, `ding-double`, `glitch`) outside a Playful video. Tutorials: clicks and typing where the screen shows them.
- One palette per video: two or three sounds, each kept for its job (the same whoosh for every title that comes in).

## How many

- In an edit of the whole video, the card's amount, spread out, never bunched; a Tender video takes none. Asked for sounds alone: about one per key moment, and one with the hook's title when it comes in with a motion that takes one.
- Asked for sounds on a video where little appears: sound what does (the title, the strongest emoji or two, a list counted out), and offer to add the graphics or emojis that would give more sounds a reason, rather than putting sounds on words.

## In your answer

Say which sounds you added and what each marks appearing ("a pop as the 🔥 comes in at [12 s]", "a pop as the price lands at [92 s]"), never a list of file names.
