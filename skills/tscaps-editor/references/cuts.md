# Cutting the video

Read this before any change to the cuts. You read the words and the sound, cut or bring cuts back, check every edge,
and say what you did. The person can change the cuts in the editor too: read them from `get_project` before changing
them, and work from what they are now.

A cut changes what the person hears, and a bad one is the first thing a viewer notices: a word clipped in half, a
breath cut short, music that jumps. A video left uncut is better than one cut badly. So cut only where the video takes
it and the sound says it is safe, and say what you left.

## How you work

1. **Read** the words (refs and times) and the sound a minute at a time with `get_transcript` (`detail: "timed"`) and
   `get_audio`, and only over the stretch the request is for.
2. **Judge** what the person asks and what the video takes (below). Cut what was asked; where the request leaves the
   choice to you ("tighten it up"), choose by the rules below.
3. **Cut** with `cut_video`, in as few calls as you can: all the words in one `cutWords`, the pauses with
   `removeSilences`.
4. **Read its answer.** Each warning names a word left, an edge in sound or a pause kept. Read `get_audio` around an
   edge in sound and move the edge into the quiet with `cut` and `restore`, or restore that cut.
5. **Tell the person** what you cut ("the long pauses, 4 s in all", "two "um"s and a sentence said twice"), what you left
   and why ("the pauses with music under them", "the fillers that keep it conversational"), and what the video could
   still take that they did not ask for.

A request to bring a cut back names it in the person's terms ("the last one", "the um before the price"): find it in
the cuts, and `restore` exactly that stretch.

## When a video takes cuts

- **Takes them:** one person talking to the camera (tips, an explainer, a vlog, a story told to the camera), where a
  pause is dead air and a filler is noise.
- **Does not:** a piece already edited at its own pace (an interview, a documentary built on archive or b-roll, a
  narration), where a pause is part of the telling; a performance; anything with music or ambient sound under the
  voice.
- **Asked for cuts on a video that does not take them,** cut what was asked only where the sound allows it (below),
  and say in a sentence what the cuts change and what you left.

## Read the sound first

The transcript only knows where the words are. A gap between them is where nothing was transcribed, not where it is
quiet: it can hold music, a laugh, a breath, a voice the transcription missed, a sound the video needs.

- `quiet` lists where the sound really is quiet: a cut belongs inside it.
- **`background: "steady"`** means music or noise runs under the voice through the video. Every cut makes it jump,
  and the jump is heard. Cut no pauses and no words: say why, and cut only if the person asks for it knowing that (`overSteadySound` for the pauses).
- **Music in part of the video** shows as levels that stay above 0 between the words over that stretch: leave that
  stretch uncut, even where the rest takes cuts.

## How much

Cut less than you could. With every pause and filler gone, a person sounds rushed and read, not spoken: their
hesitations are part of how they talk.

- **The fillers follow the video.** A quick, energetic video to the camera can lose most of them; a calm, personal or
  reflective one, or a story, only those that stall it. The pauses take `natural` in both, unless the person asks for a
  snappier pace.
- **Not every filler.** Cut the ones that stall the line: a long "uhh", a filler between two pauses, the same filler
  again and again. Keep the ones that carry the voice: a quick "you know" in a chatty line, a "so" that turns to the
  next point, a thinking "uh" before a reveal.
- **Space the cuts.** Cuts a second or two apart read as a stutter. In a run of fillers and short pauses, cut the one
  that stalls most and leave the rest.
- **Keep the beats:** the pause before a punchline, a reveal or a key number is timing, not dead air. Leave it.

## Cutting cleanly

- **Pauses:** `removeSilences: "natural"`, unless the person asks for a snappier pace (`fast`). It cuts only inside the
  quiet, leaves about a third of a second of pause inside a sentence and close to half a second between sentences,
  measured from the words' own sound, and leaves a pause that sound runs through.
- **Words:** whole words only, all in one call with `cutWords`: a filler that stalls the line ("um", "uh", "er";
  "like", "you know", "I mean", "basically", "so" only where they mean nothing), a false start, a sentence said twice
  (keep the last complete take), a word said twice in a row. Never a word that carries meaning. A filler pressed
  against a word you keep has no quiet to cut in, and `cut_video` keeps one whose cut would press the words around it
  together: leave both, and say so.
- **By time:** a stretch the person names by time is cut with `cut`, its edges moved into the quiet around them.
- When in doubt, leave it: a pause left in costs less than a clipped word.
