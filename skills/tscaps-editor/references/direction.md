# Directing an edit

Read this before any request about the video as a whole ("edit this", "make it better", "more dynamic", "make it pro", "for TikTok"), and before adding effects across the video.

tscaps edits videos of people talking, and their captions are the heart of the edit. A good edit makes the speaker easier to follow and harder to scroll past, and never competes with them. It fails in two ways: flat (the captions it already had and a couple of zooms) or noisy (something on every sentence, each in a style of its own). The cure for both is the same: read the video's tone, fix one style for the whole video, spend a small budget of effects on the moments that matter, and leave the rest alone.

**Where your judgement goes.** *What* to make is yours: which moments matter, what the title says, which number is worth setting on screen, what a b-roll should show. *How it looks* comes from the column of the video's tone (section 4), in two ways:

- **Held, always:** one style from the first frame to the last. One template with its own colours, one camera move, one transition, one palette of sounds, one look for every graphic. This is an instruction: it is what makes an edit read as one editor's work.
- **Chosen, once:** where the card names more than one thing for a tone, they are the ones that work on that kind of video, the first being the one to take when nothing about this video points to another. This is a recommendation: choose among them for this video, once, and then hold it. Do not look outside them for something more original; what is yours to invent is the content.

Two things outrank the card: what the person asks for, and what the person already chose in the project. One thing moves you off it: you looked at the result (`render_frames`) and it does not work on this picture (it covers the face, it cannot be read here). Then take the nearest choice that works, and say so in your answer.

## 1. Read the video

Before changing anything: `get_project`, the whole transcript, and one `render_frames` over the video (the start, the middle, the end; a few more on a long one). Work out four things.

- **Its format**, what is on screen: one person talking to the camera; a conversation (an interview, a podcast, a panel: two or more people, often with the video's own camera changes); a voice over footage, the speaker rarely seen; a screen or a demo.
- **Its tone** (section 2).
- **Its structure**: what the opening promises, each new point, the key moments, how it ends.
- **Its takes**: how long the picture stays the same. `get_takes` lists them: a video that changes camera by itself has many short ones; one person in one framing is a single take as long as the video (section 5).
- **What it already has**: its own b-roll, music under the voice, a caption style the person adjusted, files in the media bin (`list_catalog` with `media`).

## 2. The tone

The tone is how the video should feel, read from how it is made and what it is for, not from its topic: a video about money can be Bold or Clean. Five tones, from the quietest edit to the loudest:

| Tone | What it is | How to tell |
|---|---|---|
| **Tender** | Something heavy or intimate: a loss, an illness, an apology, a tribute, a thank-you | Slow, with pauses that mean something; the feeling is the point |
| **Clean** | Credibility is the point: a business or a brand, an expert explaining, an interview, a podcast, a talk, a testimonial | Measured delivery; a studio, an office or a stage; good sound; often several people or the video's own camera changes |
| **Casual** | Shared, not produced: a vlog, a story told to friends, a day, a recipe at home, an opinion off the cuff | A phone or a webcam, barely scripted, conversational, laughs and asides |
| **Bold** | One person convincing their audience: advice, money, business, fitness, mindset, selling, a take said with conviction | Scripted and straight to the camera; short sentences, "you", lists, numbers, claims |
| **Playful** | Made to entertain: comedy, a challenge, a reaction, gaming, a prank | High energy, fast, shouting or laughing, exaggerated on purpose |

- One tone for the whole video. A funny line in a business video does not make it Playful.
- **Between two tones, take the quieter.** Too much edit on a sober video costs the speaker their credibility; too little on a lively one costs only a little energy.
- A heavy subject is Tender whatever its format.
- The person's words outrank your reading: "fun", "energetic" or a loud creator's name move it towards Playful; "professional", "clean", "for LinkedIn", "for our company" make it Clean. Where it will be posted (TikTok, Reels, Shorts) sets the shape of the frame, not the tone.
- "Calmer" or "more dynamic" from the person moves one tone along the list, never two. Said of the captions, "more dynamic" can instead mean dynamic captions, the `dynamic-captions` guide: the same template worked by hand, scene by scene (section 6, captions), cleaner and less disruptive than a new style, and slower to make. When the request does not say which, ask, saying the difference.

Say your reading in one sentence in your answer ("A podcast clip, two people in a studio: Clean").

## 3. When the request is vague

"Edit this video" alone does not say what the person wants. Ask once before editing, with your reading in a sentence so they can correct it: the tone you read (described by what the viewer will see, "clean and sober" or "lively, with sounds and emojis"), and where it goes when that changes the shape of the frame. One to three questions, two to four answers each.

**Ask about b-roll too, on a video that would take it** (one person in one framing, a speech that names things): where its material should come from is the person's to say (section 6). Tell them what you can do, in a few words each: use footage or pictures they give you; look on the internet, where they say or where you judge best; draw animations in code, which suit some videos and not others; or call a service they have a key for, stock footage or generated pictures and video. A person who does not know what they want is helped by hearing the choices.

Do not ask when the request already says enough, or when they say "you decide" or are not there to answer: then choose what is yours to choose, and state what you assumed. Wait for the answer: change nothing before it.

## 4. One style for the video

The tone's column is the style of the whole edit. Write it at the top of your plan as the video's card, and take every later choice from it: nothing in the edit comes from outside the card. Amounts are for each 30 seconds of video: scale them to its length and round down.

| | Tender | Clean | Casual | Bold | Playful |
|---|---|---|---|---|---|
| **Caption template** | `yuki` | `enzo`; `margo` for a warm, personal story; `yuki` when the captions should only make the words readable (a long interview, a documentary) | `mira` | `nova`; `enzo` when they explain more than they assert; `ezra` for a few punchy statements | `miso`; `loki` for gaming and comic videos |
| **Opening** | the speaker's first line, no title | `hook-headline` | `hook-boxed-lines`; `text-plain` | `hook-headline`; `hook-stacked`, `hook-big-word` or `hook-neon-script` when its look suits the video better | `hook-emoji`; `hook-big-word` |
| **Camera move** | `layer-slow-push-in-camera` at 1.1 | `layer-punch-in-camera` at 1.15 | `layer-punch-in-camera` at 1.2 | `layer-punch-in-camera` at 1.2 | `layer-punch-in-camera` at 1.25 |
| **Zooms**, at most | 0 or 1 | 1 or 2 | 1 to 3 | 3 or 4 | 4 or 5 |
| **Key moments** | 1 | 1 or 2 | 2 | 2 or 3 | 3 |
| **Key-moment punch-in** | none | 1.25 | 1.3 | 1.3 | 1.35 |
| **Text graphics**, on a video made of information | none | at most 2, clean: little text, simple | none | at most 3 | none |
| **Dynamic captions**, the `dynamic-captions` guide | no | yes | no | yes | no |
| **Longest take**, the same picture with no change (section 5) | any | 10 s | 10 s | 8 s | 8 s |
| **B-roll and pictures** | the person's own only | the person's own files, and what they asked for (section 6) | the same | the same | the same |
| **Emojis** | none | none | 1 or 2 in the video | none | the template's, and 1 or 2 more |
| **Sounds** | none | 0 to 2: `swish-heavy`, `click` | 2 or 3: `swish-heavy`, `whoosh-soft`, `click`, `pop-mouth` | 2 to 4: `swish-heavy`, `whoosh-soft`, `click` | 4 or 5: `swish`, `whoosh-fast`, `click`, `pop-punchy` |
| **Transition**, around a full-frame b-roll | none | `blur`, without its sound | `blur`; `whip` on a quick one | `blur`, or `whip` | `whip`, or `blur` |
| **Music**, when there is a track | slow and sparse, no beat | a soft bed | light and warm | a steady pulse | upbeat |
| **Cuts for pace** | none | one person to the camera only | yes | yes | yes |
| **Longest plain stretch** | any | 12 s | 8 s | 6 s | 4 s |

Where a cell names more than one thing, the first is the one to take unless another's condition holds, or this video is plainly its case. The card of a 60-second Clean video reads: "Clean. `enzo`, its own colours. `hook-headline`. Punch-ins at 1.15, three; two key moments; one or two text graphics, one look; b-roll from the person's own files where a take would run past 10 s, each one moving, and nothing found or drawn unasked; `blur` into and out of a full-frame b-roll; `swish-heavy` where a graphic moves in, at most two sounds; no emojis."

## 5. The beats

An edit has rhythm when its events land on what is said, at a pace that fits the tone. Go through the transcript and mark its beats, of four kinds:

- **Key moments**: what the video is built around: the number, the claim, the reveal, the turn ("but", "instead"), the punchline, the payoff. Few: the card says how many. Each gets one treatment (section 6).
- **New points**: where the speaker starts a new idea, a new item, a new step. These take the zooms, and only the ones that carry one: the card's zooms are a ceiling, not a quota. A zoom goes where the content turns (a claim, a new item, the next step of an argument), never to fill a plain stretch or to keep a take alive; a new point said in passing stays plain, and a video may end with fewer zooms than the card allows.
- **Pictures in the speech**: what the speaker names or paints that the viewer cannot see. A specific thing (a person, a place, a product, a study, an event), or an image: an example, a comparison, an "imagine if", a metaphor with something to look at. Each is a chance to show it (section 6, b-roll and pictures).
- **Carrying words**: the words that carry each sentence. These are tagged in the captions, on every video (section 6, captions).

Then shape them:

- **It opens on speech.** The first frame has the speaker already talking: what comes before the first word that matters is trimmed (section 6, the opening).
- **Densest at the opening, calmer after.** The first seconds hold the hook and nothing competes with it. Then the edit settles: the 5 seconds after the hook leaves are captions only.
- **One peak.** The strongest treatment goes to the moment the video turns on; the others stay smaller than it.
- **One treatment per beat, never two stacked.** A punch-in and bigger captions on the same line is one too many. The sound that goes with what appears is part of that treatment, not a second one.
- **The same kind of moment, the same treatment.** Every number set the same way, every item of a list labelled the same way, every zoom the same move at the same size. A viewer reads the repetition as a style, and a new idea each time as noise.
- **Room between them**: no two graphics within 5 seconds of each other, no two sounds within 2, no zoomed shot shorter than 3 seconds, never two zoomed shots in a row.
- **No take runs long.** A take is a stretch over which the viewer sees the same picture: it ends where the video itself changes camera, and where a b-roll takes the frame. A zoom, a text graphic or a cut for pace gives a take some life and does not end it: the viewer is still looking at the same person in the same room. On a phone a take much past ten seconds reads as nothing happening, however good the words. So no take of the video runs past the card's longest, and `get_takes` measures them. A video that cuts between cameras by itself mostly keeps to it already: add zooms only inside its long takes, and fewer than the card says. One person in one framing does not: every stretch that would run long takes a b-roll, where there is material for one (section 6). Tender is the exception: there a long take is the point.
- **The shots are the tempo.** Every change of picture (a zoom, a b-roll, a graphic that takes the frame) opens a shot, so the run of shots and their lengths is the rhythm a viewer feels. Write the lengths in your plan and read them as you would a line of music: no shot past the card's longest plain stretch, lengths that vary instead of all alike, and shorter ones as the video nears its peak.
- **Plain stretches are part of it.** Talking with captions and nothing else is what makes the next event land. Only past the card's longest plain stretch does the next new point take a zoom.
- **The end lands clean.** Nothing new in the last 2 seconds, unless the person asked for a call to action.
- **On meaning, never on a timer.** Nothing goes on a pause, a filler or the middle of a thought because it was time for something.

Write the beats in your plan before making any of them, one line each: its time, what is said, its kind, its treatment, its sound when it has one. That list is the edit; the rest is carrying it out. Count it against the card first: over its amounts, drop the weakest beat rather than squeeze them in.

## 6. What each tool is for

### Captions

- `set_template` to the card's template, unless the person told you they chose the one there or it carries adjustments of theirs: then it stays. When the transcript itself tells several speakers apart (`get_transcript` shows each segment's speaker; `get_project` says under `speakers` when it tells none apart), use `yuki` for Tender and Clean and `mira` for the others, then `create_speaker_sheet` once for each voice but the first: the same look in another colour. When it does not tell them apart, never work out who says what to style by it, however clear the conversation seems: one line given to the wrong person reads as a mistake, so every voice keeps one style.
- **Keep the template as it comes** (dynamic captions, below, are the one exception): its own preset, colours, font and size are designed together, and the default is the recommended one. Do not recolour it to match the footage or to be different, and do not resize it. Move or resize the captions only when a frame shows them over a face or a line that cannot be read, and say it. A brand colour is the person's to ask for.
- **Tag the words, on every video, right after reading the transcript.** Transcription here leaves the words untagged, and a template's look depends on its tags: without them, a template that sets a few words of each sentence apart shows none. Tag the whole transcript (`edit_words`, in as many calls as it takes), by what each tag means (`list_catalog` with `word_tags`): `emphasis` on the punch word of a sentence, about one a sentence; `accent` on the short lifts that give a sentence its rhythm, two to four; `entity` on proper names; `number` on numerals; `quote` on the words inside a quotation. Do it whatever the template is: the person may change it in the editor, and the tags are what the next one draws. A warning that the template does not draw a tag is no reason to leave that tag out.
- **Dynamic captions: follow the card.** Where its row says yes, read the `dynamic-captions` guide before working on the key moments, and decide from it whether this video takes the edit and on which lines. Where it does, the lines it sets apart are the video's key moments, in place of bigger captions and of text graphics in place of the captions; the card's template stays their base, as it comes. Where the row says no, or the guide finds the video does not take it, a key moment said gets the key-moment punch-in or its captions bigger (Key moments, below).
- **Where the template shows emojis** (its description in `list_catalog` with `templates` says so, as `miso`'s does), give the captions their emojis as well (`set_emoji`): on the words where one adds a feeling or a picture, through the whole video as that look expects them, not on every caption.

### The opening

- **Trim the head first, on every video.** A video that starts with a second of nothing loses viewers before it begins. Cut what comes before the first word that matters: silence, a breath, the camera being set, a filler or a false start ("okay, so", "um, I was"). `cut_video` with `cut` from 0 to just before that word, its edge inside the quiet `get_audio` shows. Only filler goes: never a sentence that sets up the point. A trim at the head leaves no seam, so a conversation takes it too: the `cuts` guide's rule against cutting one is about cuts in the middle. The one exception is a Tender video whose opening silence is meant.
- Then read the `hooks` guide, and make the hook: every edit gets one by default, a title or the opening captions designed as the hook; leave it out only as that guide says, and say why in your answer. For a title, the card names the presets its tone takes, the first the default and the others a matter of style (the `hooks` guide says what each looks like); the words are yours, and they matter more than the look. Keep the preset's own colours. Tender has no title: the speaker's first line stands alone.

### Camera

- The card's move, at the card's size, for every zoom of the video: one move, one size. The key-moment punch-in is the only other size.
- A zoom goes on a new point: split the shot before the first word of its sentence (`split_shots` with `beforeWords`), and let it run for the sentence or the point, 3 seconds at least. Where that stretch is several shots, give `set_camera` the last of them as `through`: one call, never the same zoom set shot by shot, and never shots joined to make room for it.
- Alternate: plain, then zoomed, then plain again.
- **Zoom on a person, not on a scene.** On one speaker framed close, a punch-in reads as an edit going in and coming out. On a wide shot (people small in it, or two of them) a small zoom barely brings anyone closer and mostly shifts the picture: leave wide shots plain, or go much closer, onto the one person speaking. A close shot is never zoomed past about 1.3: the head is cut.
- **A zoom closes in on the speaker's face, not on the middle of the frame**: the face stays where it was and grows. The editor does that when it knows where the face is. On a reframed video it does: leave `x` and `y` out of every zoom. On a video that needed no reframe, tell it first, before any zoom: `set_framing` on the shots of each take with the middle of that take's speaker's face (`x` and `y` as shares of the picture, read off a frame), at `scale` 1, which moves nothing; then leave `x` and `y` out. A shot whose camera follows a person takes no move.
- After the first zoom, compare a frame just before it and one inside it: the face is in the same place, larger. A face that slid up, down or aside means the zoom went to the middle: fix where the shot looks before making the others.
- The face must stay clear of the captions.

### Key moments: felt, or read

What a key moment gets depends on what kind of moment it is.

- **Its strength is how it is said** (an opinion, a turn, a punchline, a confession, the payoff): the face and the voice carry it, and a graphic would cool it. Give it one of these, the same one for every moment of this kind:
  - the key-moment punch-in for the length of the line; or
  - its captions bigger for that scene: `set_caption_element_style` on the segment with `font-size` about 1.3 times what `get_element` reads for it, and nothing else.
- **The viewer should read it, not only hear it** (the number the video turns on, a term defined, a step or an item of a list, someone else's words, a place and a date): a text graphic (below), where the video is one a text graphic belongs on.
- **It names something the viewer cannot see** (a place, an object, an event, a product): a b-roll or a picture (below).

On Tender the one key moment takes the slow push-in and nothing more.

### Text graphics

**A text graphic is not always called for.** It belongs on a video made of information, where the viewer wants to keep something: an explainer, advice, tips, money, news, an interview that turns on data. There a number set on screen is the point. It does not belong on a video whose matter is the person: a rant, an opinion, a story, a joke, a vlog, the talk of the internet. A number said inside a complaint is part of the complaint, not a statistic: set on screen it cools the moment and turns a personal video into a report. Give that moment the camera or its captions (above), and the video no text graphic at all. That is why the card has none for Casual and Playful; the exception is a video of theirs that counts something out for the viewer to follow (the items of a list, a score, the steps of a recipe).

There are two kinds, and each has its own place in the frame. Decide which one before placing it.

- **Beside the captions**: a short line shown while the speech and its captions go on: the number being said, the name of what is on screen, the item of a list. It has to read as a thing apart from the captions: **clear picture between the two, at least the height of a caption**, and never between the speaker's chin and the captions, where the two read as one block. In a vertical frame its place is above the head, or beside it when the speaker is off the middle. Where the frame has no such room (a tight close-up), it does not fit as this kind: make it the other, or leave it out.
- **In place of the captions**: the key number or line takes over for its sentence. Give it `hidesCaptions: true`, so the captions are off while it shows, and set it where they were, at their size or larger. Never both in the same place at once.
- **Either kind is made for video, not for a web page**: typography in motion on the footage, in the caption template's own typefaces, its white and its accent, so the graphic and the captions read as one edit. The `graphics` guide's section on the look of video gives the rules of a text graphic: read it before writing one. No cards, boxes, pills, rows or bars; at most one thing in the accent.
- **A number is best in the captions' place**: counting up to land on the word that says it, the captions off, the face in view.
- **One look for all of them**: the same typefaces, the same sizes, the same way in, the same place in the frame where the picture allows. Write the first one after the `graphics` and `making-graphics` guides, then make the others from it.
- One to four words, or a number and a short label. Keep it clean: as little text as carries the point, never words added to fill the space. On screen for its sentence; it leaves before the next point starts.
- **Only what the speaker says.** A text graphic sets their words and their numbers on screen. It never adds a figure they did not give, the other side of a number worked out from theirs, or a claim of your own: on screen it reads as theirs.
- Split the shot to the moment first (`split_shots` with `beforeWords`: before its first word, and before the first word after it), then `add_graphic` on the shot between. Never over the face, never in the bottom fifth of a vertical frame.
- Look at it with a caption on screen at the same moment (`render_frames`): clear picture between them, or the captions off. A graphic that touches the captions is moved or changed in kind, never left.

### B-roll and pictures

Showing what the speech paints is what makes an edit feel made for this video and not laid over it.

**Where it comes from is the person's to say.** B-roll needs material, and which material is not yours to decide.

- **The person's own files are used without asking**: what is in the media bin (`list_catalog` with `media`, `look_at_media` before placing) and what they hand you.
- **Everything else is on their say**, and there are four ways, each of which you can do:
  - they give you footage or pictures for this video;
  - you look for material on the internet, where they tell you to or where you judge best (the `sourcing` guide);
  - you draw animations in code (the `scenes` guide), which suit some videos and not others;
  - they have a service for stock footage, or for generating pictures or video, and give you its key: you make the requests yourself, with a small script where it takes one (the `sourcing` guide).
- **When nobody is there to answer, or they leave it all to you: no b-roll but from their own files.** Do not search the internet and do not draw scenes unasked: both take long and cost the person money, and what comes back is not reliably good enough to go in their video without their eye on it. Make the rest of the edit, read the takes (`get_takes`), and in your answer say which stretches would take a b-roll and offer the four ways in a sentence or two.

**How many, where there is material: enough that no take runs past the card's longest.** The takes set the amount, not the tone and not a count of the pictures in the speech. Once the cuts are made, read the takes (`get_takes` with `atLeastSec` at the card's longest): every take it lists needs a b-roll inside it, and one two or three times that long needs two or three, placed so that no stretch between them runs past the limit either. A video that changes camera by itself may need none. One person in one framing for a minute needs five or six.

- **The take says a b-roll is needed here; the speech says on which sentence.** Inside each long take, take the sentence that most paints a picture (section 5), as near the middle of the stretch as the speech allows. It still lands on what is said, never on a timer.
- Where a long take names nothing to show, show what it is talking about: the place, the object, the activity. The opening is no exception: once the title has left, its take is counted like any other. A take left long where there was material to show is a fault you report, not a choice: one in a video at most, with a zoom in it, named in your answer.
- Past that, show any other picture in the speech that is concrete (a named thing, a place, a person in public life, an event), as long as the speaker is back for 3 seconds between two b-rolls and all the b-roll together stays under a third of the video.
- **Fewer on two kinds of video.** Tender: the person's own material only, and long takes are right. And a video whose matter is the face (a rant, a joke, a confession, a reaction): there a take may run to twice the card's longest, kept alive by its cuts and by a zoom where a new point takes one, and a b-roll goes only where the speech names something worth seeing.
- When the b-rolls are placed, read `get_takes` again: `longestOfVideo` is within the card's longest, or your answer says which stretch is not and why.

- It starts on the word that names it and stays for the sentence that paints it, 2.5 to 5 seconds, a drawn scene up to 6: long enough for what moves in it to finish and be looked at for a second. Cut sooner and it reads as a flash. The speaker stays on screen for most of the video: all the b-roll together, a third of it at most.
- **Its form follows what the sentence does**, and the wrong form reads as empty or as too much:
  - *One image with something happening in it* (an arrival, a quarrel, a change, a place): one b-roll over the whole frame.
  - *A list of things named one after another*: never one b-roll with small things scattered in it. Either a mark for each, drawn over the video beside the speaker and landing on its word, the speaker staying in view; or a quick run of pictures, one for each word, under a second each, cut on the words.
  - *A number or a few words to keep*: a text graphic, not a b-roll.
- **The viewer meets the speaker first.** No b-roll in the first 6 seconds: the face, the voice and the title are what make someone stay, and a picture before them is a video about nobody. The first b-roll comes between there and the end of the opening take.
- Never over a moment the face carries (an opinion, a punchline), and never two in a row, but for a run of pictures over a list.
- **One look for the video's b-rolls**, as for everything else: found pictures of one kind (photographs, or paintings, or archive footage), not a mix of them. When the search gives a mix, take the kind most of the video's pictures can be found in, and search again for the ones that are not.
- **A still picture never sits still, and never rushes.** Every picture used as a b-roll takes a camera move on its layer for as long as it shows. Lay the layer out first (`set_layer`: its layout, the shots it runs through), then `set_camera` on the layer: a slow push-in (`layer-slow-push-in-camera`, to 1.1 or 1.15) on a subject in the middle of it, or a pan (`layer-pan-right-camera` or `layer-pan-left-camera`) across a picture much wider than the frame. Pick a pan with no `fromX` or `toX`: it then drifts slowly about the picture's middle, and the answer says how far it `travels`. A pan from one edge of the picture to the other is a swipe, not a drift: more than about a third of the frame's width over a picture's few seconds is too fast. Vary the moves from one picture to the next. A picture left frozen for three seconds reads as the video having stopped.
- **A picture is what it shows, not what it is.** The viewer sees it for three seconds and has not read its title. Before placing a picture, look at it (`look_at_media`) and say what a stranger would say is in it, in three or four words. When those are not the words being said, it is out, however apt the story behind it. Then look at the frame it makes with its caption on (`render_frames`): the word and the picture read as one, or the picture goes.
- **Found material**, when the person asked for it: read the `sourcing` guide before fetching anything; it says what may be used. Every found piece is named in your answer with its source and licence; nothing about credits goes on the video unless the person asks.
- **Drawn scenes**, when the person asked for them: by the `scenes` guide, in one style, as the video's b-roll rather than a few among found pictures: two looks in one video read as two edits.
- **Something of the internet** (the post being answered, a meme, a headline as it was published): not licensed, so only on a creator's own channel and only when the person asks for it or agrees (the `sourcing` guide).
- A number or a few words to keep are a text graphic (above), not a b-roll.
- **It takes the whole frame** (`full`): for 2 to 4 seconds the picture is the video. Half a frame each for the picture and the speaker (`split`) shrinks both and reads as a slide; it is for when the person asks for it, or the speaker is pointing at what is shown. Casual and Playful can also set a picture over the video as a sticker.
- **A b-roll hides a rough cut.** Where a cut for pace leaves a jump that shows, or the video itself cuts roughly, a b-roll laid across the seam (starting a moment before it, ending after) covers it: the viewer sees the picture, not the jump. When choosing where the b-rolls go, give those seams the first ones.
- One that takes the whole frame comes in and goes out with the card's transition (below).

### Emojis

Only where the card allows them, on a moment that carries a feeling, as a human expression (😅 🤯), never an object that repeats the word (`set_emoji` on the word).

### Sounds

Read the `sound` guide: a sound marks something that appears or moves on screen, never a word as it is said. The card names which sounds and how many: one palette for the video, each sound kept for its job (the swish or the whoosh for what moves in, the pop for what pops in place, the click for a key line revealed). A hook preset, a camera move or a transition that brings its own sound keeps it, and it counts in the card's amount. You cannot hear the result: say in your answer that the mix was set by measure, not heard.

### Music

Only with a track the person gives (`add_media`, then `set_audio` with `music`), or one found when they ask (the `sourcing` guide). Under a voice it starts at `volume` 0.1, 0.07 on Tender and Clean, with no lyrics, fading in and out. A video that already has music under the voice takes none.

### Transitions

A transition is for a b-roll that takes the whole frame: a clip, a picture or a drawn scene laid out `full`. One into it and one out of it, in the card's one kind, at one length (0.3 to 0.4 s). Only `blur` and `whip`: the other kinds are for when the person asks for them.

Everywhere else the cut stays plain: between two shots of the speaker, where a cut for pace joins two pieces, into or out of a zoom, around a graphic set over the video or a b-roll that shares the frame (`split`), at the video's own camera changes. A transition on a plain cut reads as an effect with nothing behind it. So a video with no full-frame b-roll has no transition, on any tone. A transition's own sound stays, except where the card leaves it out (`sound: false`), and counts among the card's sounds.

### Cuts

The head is trimmed on every video (the opening, above). Past it, where the card allows cuts and the video is one person talking to the camera with nothing playing under the voice: cut what stalls it, by the `cuts` guide, before anything is placed, and say what you cut. Not a conversation, not a piece already edited at its own pace.

### Names, colour, calls to action

- A name and role (`speaker-minimal`) the first time a guest or an expert is on screen, on Clean conversations, once per person, and only when the transcript or the person gives the name. Never on a creator talking to their own audience.
- The colour grade is part of the footage: leave it unless asked.
- A call to follow or subscribe only when the person asks, with their real handle.

## 7. The order of the work

1. Read the video, settle the tone, write the card and the beats in your plan (the `planning` guide).
2. The shape of the frame, when it changes: `reframe_video`. Everything after is placed in that frame.
3. The head trimmed, so the video opens on speech; then cuts for pace, where the card allows them.
4. The caption template; then the words tagged through the whole transcript, and their emojis where the template shows them. Where the card says yes to dynamic captions, read the `dynamic-captions` guide now.
5. The opening.
6. Every split the beats need, then the zooms.
7. The key moments, one at a time, each looked at.
8. B-roll and pictures, from the person's own files and from what they asked for: read the takes (`get_takes`), place what keeps every take within the card's longest, each picture looked at for what it shows, each one moving; read the takes again.
9. Sounds, last: they attach to what is already there.
10. Look at the whole (section 8), then answer.

## 8. Look, then take away

- `render_frames` at the hook, at every key moment and graphic, and at the end; with `strip: true` over each scene and each graphic that moves, from its first moment to its last, to see it across its time.
- Read the edit against the card, line by line: one template with its own colours; one camera move at one size; the amounts of zooms, graphics, sounds and emojis; one look for every graphic; one transition, only around a full-frame b-roll. What is outside the card comes out, or goes on the card with the reason, in your answer.
- The first frame has the speaker already talking. Every graphic stands clear of the captions, or has them off. Every still picture moves, slowly, and shows what is being said. Every zoom closes in on the face. Where there was material for b-roll, no take of the video runs past the card's longest (`get_takes`). The words are tagged from the first caption to the last.
- Nothing over a face; nothing important in the bottom fifth of a vertical frame, where the platform's own text and buttons sit; every text readable at phone size.
- Ask of the whole: would someone scrolling take this for the work of one editor with one idea of the video? If it feels busy, take out the weakest effect. If it feels flat, check that every key moment has its treatment before adding anything new.
- **When in doubt, take it out.** An effect you are not sure of costs more than the gap it leaves.

## 9. What reads as amateur

Each of these is enough to make an edit look cheap:

- two styles of the same thing: two zoom moves, two transitions, three typefaces, a second accent colour;
- captions recoloured away from their template;
- an effect on a timer, or on every sentence;
- two effects stacked on one beat;
- a sound with nothing appearing, a cartoon sound on a sober video, a sound as loud as the voice;
- text over the face, or under the platform's buttons;
- a graphic that looks like a web page: a card, a pill, a badge;
- a zoom shorter than 3 seconds, or one that cuts the head;
- a transition on a plain cut: between two shots of the speaker, around a zoom or a graphic;
- an emoji that repeats the word as an object;
- every word of a line tagged as its punch word, or no word tagged at all;
- a still picture left frozen on screen, or a pan that sweeps across one;
- a picture the viewer cannot connect to the word being said;
- a zoom that closes in on the middle of the frame while the face slides away;
- a title that labels the topic instead of promising something;
- a second of nothing before the first word;
- a graphic touching the captions, so the two read as one block;
- a statistic set on screen in a video that is a person's rant, story or joke.

## 10. The answer

Short: your reading (format and tone) in one sentence; the card in one sentence; the opening; each key moment and what you gave it ("when you give the number at [13.2 s], it is set beside you"); what you assumed; what you could not judge (the sound mix, by ear); and the one alternative most worth offering ("I can make it calmer"). Where the video would take b-roll and has none, say which stretches, and offer the ways to get it (section 6).
