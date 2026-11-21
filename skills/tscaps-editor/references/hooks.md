# Hooks

Read this before making or changing the opening of a video: when the person asks for a hook, a title at the start, a stronger opening, or a whole-video edit where the opening could carry more.

The hook is the first one to three seconds: what makes a viewer stop scrolling. It is a judgement call, not a rule to apply: read the video, decide what would make *this* opening stronger, and do it well. There is often more than one good answer; pick the one you believe in, and offer the other in a sentence.

## The ways to do it

- **Write a title over the opening: the recommended way.** A graphic with a short line on screen that is not the transcript: the promise of the video, written the way a video title or a headline is ("I quit my job to edit videos", "5 apps I use every day"), in the speaker's voice when they speak in the first person. When the promise is in what is said, write the whole idea it builds to, never the first few words of the sentence, which rarely say anything on their own.
- **The opening line set as a poster**, on a video that takes dynamic captions (the `dynamic-captions` guide): the first sentence set across the frame around the person, in place of a title. Weigh it against the title when the opening shot leaves room for it.
- **The opening captions, designed as the hook.** The first sentence as it is said, set apart from the captions after it: as a poster (the `dynamic-captions` guide) when the opening shot leaves room around the person; a hook caption look (`set_hook_captions`) where it does not. This is a hook as much as a title is, and needs no graphic: take it when the opening line already says the promise, so a title would only repeat it.
- **Tease a moment from later.** Not possible in this editor yet. If it would be the best opening, say so as an idea, and do one of the others.

Every edit of the whole video gets a hook by default. Leave it out only when the video has no promise to put on screen and its opening already holds the viewer on its own, and say why in a sentence. A clip the person only wants captioned needs none.

## Finding the hook

- Read where the opening promise ends in the transcript: usually the first sentence or two. A word tagged `hook` marks what transcription read as the hook; take it as a hint, not an answer.
- A title stays for its shot. Split the shots so the first one ends where the hook does: `split_shots` with `beforeWords` and the first word after the hook, so the cut lands in the silence between the two. Split first, then add the title: a split made afterwards does not shorten it. Between about 2 and 5 seconds is usual; long enough to read it twice.

## Writing the title

A short line on screen that makes someone stop and want the rest. Not a transcript, not a topic: a promise. Find it in the whole transcript, not only the first sentence: the stakes, the conflict, the surprising number, the question the video answers. Then write it as one of these:

| Kind | Example |
|---|---|
| The stakes, with the number when there is one | "We have 48 hours to move out" |
| A contrast | "They paid $3,000. I paid $40." |
| A take against the usual advice | "Stop buying a better camera" |
| A question the video answers | "Why does nobody finish your videos?" |
| A list it delivers | "5 apps I use every day" |

- **Use the number** when the stakes have one (money, a count, a percentage, a time): a specific number stops the scroll where a general claim does not.
- **Three to eight words**, words a 10-year-old knows, one or two lines.
- **The speaker's voice**: "I" when they speak about themselves, "you" when they speak to the viewer.
- **It opens a question and keeps the answer back.** Never the punchline or the ending.
- **True**: the video delivers what the title promises.
- No hashtags, no quotation marks, no emoji in the text.

Weak titles, and why:

- A topic label ("Gear update", "My thoughts on gear"): no stakes, nothing to stay for.
- The first words of the transcript ("Okay so, welcome back"): the preamble again.
- Vague clickbait ("You won't believe this"): promises nothing in particular.
- The whole point given away ("Gear doesn't matter, skill does"): nothing left to wait for.

Write three, then keep the one with the most specific stakes or the sharpest contrast.

## Which preset

Take the presets of the video's tone, as the `direction` guide reads it, and write the title to its fields (`list_catalog` with `graphic_presets`). The first is the default; take another of its row when its look suits this video better. It is a matter of style, not a rule on the title: look at what each one is and picture it on this video.

| Tone | Presets |
|---|---|
| Casual | `hook-boxed-lines`, `text-plain` |
| Playful | `hook-emoji`, `hook-big-word` |
| Bold | `hook-headline`, `hook-stacked`, `hook-big-word`, `hook-neon-script` |
| Clean | `hook-headline` |
| Tender | None: the speaker's first line stands alone |

What each looks like:

- `hook-boxed-lines`, Text box: lines on one joined box, the way the platforms set text.
- `text-plain`, Plain text: white text with a thin outline over the picture, nothing else.
- `hook-emoji`: a large emoji over three tight, heavy lines, one phrase in an accent.
- `hook-big-word`: a short lead-in, then one word as large as it fits.
- `hook-headline`: a bold sentence, one phrase in it swept with a marker. Clean and works for almost any title.
- `hook-stacked`: tall condensed capitals, every line as wide as the others, so a short line comes out larger. Loud, like a poster.
- `hook-neon-script`: a lead-in, one word large, and a word in glowing script across it. Warm and personal.

The other hook presets only when the person asks for that look. Keep the preset's own colours.

A preset's text field takes line breaks: each line of it is a line on screen, so break a title where it reads in beats.

## Making it look right

- Place the preset with `add_graphic` (`preset`, its fields in `params`) and look at it. Too small or in the wrong place: `set_layer` on its layer (a bigger box makes everything in it bigger). Its look or motion not right: `edit_graphic` on its layer.
- Write one of its own (`add_graphic` with `graphic`, after the `graphics` guide) when none fits what this video needs. A hook written for the video can be better than a preset.
- On screen from the very first frame, and in quickly (about 0.3 s). Three to eight words, readable in two seconds.
- In the top third, clear of the face and of the bottom fifth of the frame, where the platform's text and buttons sit.
- It and the captions must not fight. Hook presets keep the captions off their shot; for one of its own, decide it in its code: hide the captions of its shot when the title carries the opening, or place it so both read.
- Look at it (`render_frames` at the first frame, once it has landed, and just before its shot ends) before you answer.

## Telling the person

Say in one sentence what you did and why it suits the video, then offer the other way you considered, in one line ("I can also show your opening line itself, bigger, instead of the title").
