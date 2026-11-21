# Dynamic captions

Read this before editing the captions themselves across a video, scene by scene: the lines the video turns on (key lines, below) set apart from the rest, in a look of their own. Read it when the person asks for worked or more dynamic captions, captions "like an edited video", or when a whole-video edit (the `direction` guide) finds the video takes this edit.

Done well, it reads as a person editing by hand: most captions stay quiet, and every few seconds a sentence that matters builds on screen as it is said, set like a headline, each one a little different from the last. Done badly, it reads as noise or as a template stamped on every sentence. The difference is judgement on every line, not a rule: this guide gives you the way of thinking and the pieces, and you decide each line.

## 1. Whether the video takes it

Decide first, from the transcript and a `render_frames` over the video.

It fits a video where **what is said is the point** and the viewer reads along: one person talking to the camera, telling a story, explaining something, making an argument, giving facts, numbers or steps; usually spoken fast and cut tight.

It does not fit, or only lightly (one or two key lines in the whole video):

- **The person is the point**: comedy, a vlog, a reaction, a moment that just happened. The face and the voice carry it; type over it competes with them.
- **Several people, or a wide shot**: people small in the frame. There is no one head to set lines around, and a caption style per speaker already does the work.

When it does not fit, say so in one line and edit the captions the `direction` guide's way instead.

On a professional or brand video, when it takes this edit: lighter, cleaner key lines; nothing heavy.

## 2. Two layers

- **The base: every caption that is not a key line.** Quiet: small, one to three words at a time, under the chin, in one look from start to end. It carries the speech; it is never restyled for a moment. A template in that spirit suits it: plain type, little motion, no boxes. This edit plays best over simple, clean templates, like `enzo`, `margo`, `ezra`, `cleo` or `rhea`. Its place for the whole video is `set_caption_position`, checked on the closest shot so it stays under the chin.
- **Key lines: the sentences that matter**, each shown whole as one caption while it is said, set as a stack of one to three lines in the lower half of the frame, near where the base reads. They are captions like the rest (the same words, at the same time), so the base does not show while a key line does.

Place each key line with `set_caption_element_style` `placement` on its caption (its centre, as shares of the frame), looking at the frame of that moment: the face moves with the shot's camera and framing, so a place right for one shot can cover the face in the next. Its contrast of type is what sets it apart from the base, so it does not need to move far: across the chest, a little above or below the base's place, or beside the speaker on the clear side of the frame. Never over the face. Not above the head by default: a large block appearing at the top of the frame pulls the eye off the face, and the head often fills that space in a vertical frame; only a short line on a frame with clear room there. A poster (section 6) is the exception: it is set around the head by design.

## 3. The kit, decided before the first key line

Write it in the plan, then use only what is in it. Consistency comes from the kit; the variety comes from how you combine it, line by line.

**Start from the base template's own look, then set the key lines clearly apart from it.** A key line is the same voice, louder: its type and colours come from the template, and the contrast between its lines is what makes it read as edited. Size and weight alone are too little; the contrast of two voices of type is what carries this edit, and colour is what makes it loud.

- **Type: two voices.** A delicate one and a heavy one, the line that pays off in the larger of the two. When the template pairs two families, take its pair. When it has one, keep it for the heavy voice and give the other a delicate face that pairs with it: a serif, its italic, or a script or a hand on a casual or playful video. The `fonts` guide lists pairs that hold together, the two families with a true italic, and the weights each family has. The scale can run either way: the heavy line big under a small setup, or a huge italic payoff under a small sans. On a plain, professional video, the same family at its lightest weight is the quieter choice.
- **Outline and shadow: thinner on the light voice.** The template's outline and shadow are drawn for its own type, and on a finer face they clog the letters. Read how it draws them (`get_element` on the sheet, `include` its CSS: `-webkit-text-stroke`, `text-shadow`, a filter), and give the words of the lines that set up a thinner one, about half, or a soft shadow in place of a heavy outline: `set_element_css` on the line, keeping what its CSS already holds (`get_element` first), with the rule in `& :where(.word)`. Look at it close with `render_frames` `region`.
- **No boxes, pills or panels behind a key line**: they read as a sticker laid over the video rather than as type. A key line stands out by its type, its size and its colour.
- **Colour: the template's own, used sparingly.** Its text colour for most words; its own highlight or accent for the word that matters, on some key lines rather than all. A colour of the template's own over one of yours; a second colour, kept for one meaning (the worst news, the climax), at most once or twice in a video, and only where the tone carries it.
- **Set-pieces**: a few from section 7, picked for what this video says; a calm or casual video may need none.
- **Its sounds**, when the edit has sounds (section 8).

## 4. Which lines are key

- The opening question or promise; the first sentence of each new point; the number; the claim; the turn ("but", "instead", "the catch is"); someone else's words; the reveal; the line the video ends on.
- Roughly one every 3 to 6 seconds in a video made for this edit, fewer in a calmer one. Base captions run between them, so each key line arrives as an event.
- Short: about eight words at most. When the sentence is longer, set apart the part that carries it and leave the rest to the base.
- The opening sentence set as the first key line can be the video's hook, in place of a title graphic: the `hooks` guide names it as a way. Say so when you choose it.

## 5. Setting a key line

1. **Make it one caption** with `make_caption`, from its first word to its last, whatever captions they are spread over now.
2. **Break its lines by sense** with `set_caption_lines`: each line a phrase that reads on its own; the word that matters at the end of a line or on a line of its own. Never split a name, a number and its unit, or a word from the one it belongs to.
3. **Give each line its weight**, with `set_caption_element_style` on the lines and words (`font-family`, `font-weight`, `primary-color`, and the size: `font-size` on a line, `relative-size` on a word); one call styles every line that takes the same look. The two voices far apart in size, the big one two to three times the small, and the lines tight, so the stack reads as one block. Give each line of a key line its own `line-height` in `em`, which follows that line's own size and sets the space above it: about 0.7 for a large line under a small one (sans or serif alike), about 0.85 for a large line under another large one, whose letters reach further up and down, and about 1 for a small line. The aim is ink nearly touching: the gap between two lines' letters no more than about a twentieth of the larger line's size (`set_element_css` on the line, keeping all its CSS holds, since it holds what the line's fields wrote: read it first with `get_element`). A template often sets its leading once for the whole caption, so a line made bigger overlaps the next until it has one of its own, and the sheet's `lineSpacingEm` moves every line alike without fixing that. Look close, and tighten until the lines nearly touch but no letters do; the accent on one word or one short phrase. One heavy line in a stack, two at most; two sizes, never three.
4. **Make it appear as it is said**: `set_element_animation` on the caption, scope `words`, a quiet preset (`fade-in`, `rise-in`), so each word lands when it is spoken and the stack builds. Read the `animation` guide the first time. Every key line arrives this way, never whole at once: a stack that appears in one piece loses the edit. When words one by one misbehave in this template, bring its lines in one by one instead (`set_element_animation` on each line, scope `self`), and never drop the entrance. `set_element_css` replaces an element's whole CSS, the blocks its animations wrote included: keep them when you write it.
5. **Place it** (section 2).
6. **Look** at it as its last word lands, with `render_frames`. A base template that shows only the word being said hides the rest of the stack: then pick a base template that shows its captions whole, before going on.

**Set it as a lockup**, the way a poster or a title sets its type: the lines fitted together as one shape, judged by the eye rather than by their boxes.

- **Optical alignment.** The eye weighs letters, not boxes: a trailing period or comma, a quote mark or a short last word makes a centred line look off-centre. Drop a key line's closing period or comma (`edit_words` on its last word), as a headline does; keep a question or an exclamation mark, which carry meaning. Then choose the alignment that gives the stack a clear shape: centred when the lines are close in length, flush left (or right) when they differ a lot, the lines sharing that edge (`text-align` on the caption's lines).
- **Nesting.** A small line over a big word can tuck into the room the big word leaves: beside a tall letter at one end of it (l, k, h, d, b, f, t), or over the short letters next to it. Set the small line flush to the other side and pull it down into that room, so the tall letter rises beside it and the two read as one block (on the small line, `text-align` and a negative `margin-bottom` in `em`, or a `translate`). Do it only where the room is really there; look at it close, with `render_frames` `region`.

**The typography of a lockup.** What separates set type from text that only got bigger:

- **One dominant element**: the word or phrase the line turns on, at least twice the size of everything else in the lockup. Two big lines of equal weight compete; one leads.
- **Weight in big steps**: a light or regular voice (300 to 500) against a heavy one (800 to 900). Neighbouring weights (600 beside 700) read as a mistake, not a choice.
- **Spacing follows size**: large display type set tighter (`letter-spacing` -0.02 to -0.04em), since big letters look loose at their default spacing; small lines left as they are or a touch open (up to +0.02em); a word in capitals opened (+0.04 to +0.08em). An italic serif is never tightened.
- **Capitals for a word or two at most**: a whole line in capitals loses the shapes of its words. An italic serif never in capitals.
- **Width**: the small voice never runs wider than the dominant line it sits with. When it would, break it into a shorter phrase, move words to the base captions, or make the dominant line bigger.
- **Line breaks**: no short word left alone on a line unless it is the dominant one. Lines either close in length (a block) or clearly stepped (short over long); three lines almost, but not quite, the same length read as an accident.
- **Typographic marks**: curly quotes and apostrophes (“ ” ’) rather than straight ones (" '), fixed with `edit_words` on a key line's words.
- **The same settings throughout**: every lockup's small voice at the same size, weight and spacing through the video. Vary the arrangement, never these.

Vary the arrangement from one key line to the next: which line is heavy, one line or three, where the accent sits, a set-piece now and then. Two key lines in a row set the same way read as a template; the kit keeps them related.

## 6. The poster

Once or twice in a video, at the hook or at its peak, a key line can be set across the whole frame, the way a film poster or a magazine cover sets its title around the figure: its words spread over the picture, each where the picture leaves room, building as they are said. It is the strongest thing this edit does, so it is kept for the line the video turns on, on a shot that leaves room for it: one person, with space around them (sky, a wall, a plain background). On a busy or crowded frame, or where there is no room around the person for the captions, set the line as a usual key line instead.

- **One caption, its words placed one by one.** Make the line one caption (`make_caption`), then place each word, or each short group of words, on its own with `set_caption_element_style` `placement` on the word: a placed word leaves its line and goes where you put it, and still comes in as it is said. The base does not show meanwhile: the poster is the caption.
- **Layout first.** The groups run down the frame in reading order and alternate sides around the person, so the type surrounds them: some above or beside the head, some lower on the body, where the frame has the most room, using the frame's height. Text on both sides of the person, a margin from every edge, air between one group and the next, never over the face. A composition that leaves one side empty or piles the type against an edge reads as a mistake, however well each group is set.
- **Beside the head, two limits.** A group beside the head fits between the face and the edge of the frame, touching neither; the word set behind the head (below) is the only one that meets it. On the side where a group's first word faces the head (the right, in a language read left to right), nothing tucks behind it, so the face is a hard limit. When a group does not fit between the two, make that group smaller, or move it down toward the neck, or up beside the forehead where there is room there.
- **Groups of a big word and a small one.** The word the group turns on large, the words that link it small and held close to it, aligned to one of its edges. Two or three such groups make a poster.
- **The two voices carry meaning.** The heavy one for the words that build the sentence; the delicate one (the serif italic, or the sans at its lightest, slanted) for the words of image or feeling, the ones the video is about. The large words alternate between the two.
- **Depth on one word.** Where a large word meets the head, put that word behind the person (`set_caption_element_effects` `behindPerson` on the word): the head covers part of one letter at its end, never a whole letter, never its start or its middle: in a language read left to right, a word to the left of the head. The word large enough, and close enough to the head, that part of its last letter clearly passes behind it; a word that only grazes the head reads as a mistake, not as depth. The person moves, so look at it over the whole time it is on screen.
- **Motion stays quiet.** Each word appears as it is said, quickly, and stays until the poster leaves; the type does the work, not the motion.
- **Contrast.** White type on a light or busy background needs the template's shadow darker; the delicate voice loses first.
- **Look** with `render_frames` as each group lands and at the last word: both sides used, the face clear, nothing against an edge.

## 7. Set-pieces, by meaning

A set-piece is a stronger treatment for one key line, chosen because of what the line says. Most key lines get none: two or three in a whole video is plenty, a calm one may have none, and never two in a row. A set-piece's motion is how its word or line comes in: it replaces the build's entrance for that element, and starts hidden. **Motion keeps the template's character.** Read how the template moves its own words (`get_element` on the sheet lists the animations it declares) and stay in that family: a key line's words come in the way the template's do, and a set-piece only a degree stronger, a little slower or a little further, never another kind of motion. The tone sets the ceiling: fades, short rises and short slides suit almost any video; `snap-in`, and anything that overshoots or bounces, only a playful one. A set-piece already stands out by its size, its type and its colour: a lively motion on top of a big word says it twice, and reads as playful on a template that is not.

Of the presets, `fade-in`, `rise-in`, `slide-in`, `snap-in`, `smear-in` and `flash-in` start hidden. `scale-in`, `pop-in` and `wobble-in` do not: the word shows at its first frame before its moment and then grows, shrinks or shakes as it is said, a motion in two parts that reads as a glitch. Never put them on a key line. A word that should land by its size takes keyframes of your own that start hidden (opacity 0 in the first one; the `animation` guide), in one motion, as it appears.

| What the line does | Set-piece | How |
|---|---|---|
| A twist or a surprise ("the catch is", "it wasn't") | the word that turns it comes in with its own motion | `set_element_animation` on that word or line: the template's own entrance a degree stronger, or a short `slide-in`; `snap-in` only on a playful video (section 7) |
| It raises the stakes ("on top of that", "even") | the word that raises them larger still, in the accent colour | `set_caption_element_style` on that word: `relative-size` and `primary-color` |
| One word carries the line: a name, a nickname, a one-word verdict | that word alone, large, in quotes or capitals | its own key line of one word, coming in the template's way, a little slower |
| Words written somewhere, read out: a text message, a sign, a review | the words appear one by one, quickly and without moving, as if typed | scope `words` with a short `fade-in`, and `typing-short` when the edit has sounds |
| The worst number or the worst news, the climax | that word in the colour kept for it | `primary-color` on the word |
| Someone else's words | the other voice of type, or quotes around it | `font-family` on the line, or the quote marks as part of the line's look |

An idea none of these fits is a graphic, not a caption: leave it, or offer it.

## 8. Sounds

When the edit has sounds (the `direction` guide's card names them), and by the `sound` guide. A key line that builds as it is said is revealed as it is spoken: the sound goes on the first word of the line it marks (`add_sounds` `at.word`), the `click` the `sound` guide gives a key line revealed.

- Not every key line: the ones that matter most, two seconds apart at least.
- A set-piece takes the sound of how it comes in: one that slides in a `swish-heavy` (`swish` on a playful video), one that pops in place `pop-mouth` (`pop-punchy` on a playful video), typed words `typing-short`.
- None on base captions.

## 9. Look at the whole

- `render_frames` with a picture at every key line, as its last word lands, side by side: one kit throughout; no two neighbours set the same way; each reads in under a second; none covers the face or reaches the bottom fifth of the frame.
- Watch the stretch around a key line: the base before and after, the key line building as it is said, nothing on top of anything.
- When it feels busy, take out set-pieces first, then the weakest key lines. When it feels flat, the key lines are too alike or too few.

## 10. Never

- Every sentence a key line.
- A font or a colour outside the kit, or the kit changed halfway through the video.
- The base restyled for a moment: moments are key lines.
- A card or a panel behind a whole stack: key lines are typography.
- A key line over the face, or one the viewer cannot finish reading before it leaves.
