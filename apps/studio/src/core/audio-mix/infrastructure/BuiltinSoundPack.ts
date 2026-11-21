import type { BuiltinSound } from '@core/audio-mix/domain/BuiltinSound';

/** A sound of the pack as listed here; its file is `sounds/<id>.ogg` under the app's public folder. */
export type BuiltinSoundEntry = Omit<BuiltinSound, 'url'>;

/**
 * The sounds bundled with the app, in the order each category offers
 * them. Ids are append-only: a stored clip names its sound by id, so a
 * sound is never renamed and an id is never reused, not even one the
 * pack has retired (a clip naming a retired id reads as a missing
 * sound). An id keeps its meaning: a better take on the same sound may
 * replace its file, while a different sound gets a fresh id. Lengths are
 * the files' decoded lengths, as the pack's build prints them. Where each file comes from, and its
 * licence, is in `public/sounds/ATTRIBUTION.md`.
 *
 * Each `underVoiceVolume` puts the file's loudest 50 ms at the level its
 * kind sits under a voice, read from the owner's own tuning by ear of the
 * camera moves' and the hook presets' sounds: about -31 dBFS for a
 * whoosh, -22 for a swish, -24 for a click or a short hit, -25 for a pop,
 * -28 for a marker stroke or a boom, -30 for a ding and -32 for a riser.
 * A file replaced by a better take is measured again.
 */
export const BUILTIN_SOUND_PACK: readonly BuiltinSoundEntry[] = [
  { id: 'whoosh-soft', name: 'Soft whoosh', category: 'whoosh', lengthSec: 0.5935, underVoiceVolume: 0.061,
    description: 'A soft, airy whoosh. Something sliding in or out: text or a graphic entering, a cut into b-roll, a transition.' },
  { id: 'whoosh-fast', name: 'Fast whoosh', category: 'whoosh', lengthSec: 0.4535, underVoiceVolume: 0.072,
    description: 'A quick, light whoosh. A fast entrance, a snap zoom, a quick slide.' },
  { id: 'whoosh-deep', name: 'Deep whoosh', category: 'whoosh', lengthSec: 1.1135, underVoiceVolume: 0.07,
    description: 'A long, low whoosh that swells and falls away (1.1 s). A big move: a transition into a new part, a slow zoom.' },
  { id: 'whoosh-pass', name: 'Pass-by whoosh', category: 'whoosh', lengthSec: 0.8935, underVoiceVolume: 0.076,
    description: 'A whoosh passing by, rising then falling (0.9 s). Something crossing the frame: a wipe, a whip transition, a graphic sweeping across.' },
  { id: 'swish', name: 'Swish', category: 'whoosh', lengthSec: 0.1535, underVoiceVolume: 0.21,
    description: 'A very short, thin swish. A small quick move: a word or a sticker flicking in.' },
  { id: 'swish-heavy', name: 'Heavy swish', category: 'whoosh', lengthSec: 0.1135, underVoiceVolume: 0.24,
    description: 'A very short, heavy swish. A hard snap: a crash zoom, a word slammed on screen.' },
  { id: 'page-turn', name: 'Page turn', category: 'whoosh', lengthSec: 0.6135, underVoiceVolume: 0.14,
    description: 'A book page turning. The next point of a list, a new chapter.' },
  { id: 'pop-bloop', name: 'Bloop', category: 'pop', lengthSec: 0.1135, underVoiceVolume: 0.14,
    description: 'A cartoon bloop rising in pitch. Something playful popping in, an emoji or a sticker; light, comic videos only.' },
  { id: 'pop-mouth', name: 'Mouth pop', category: 'pop', lengthSec: 0.1535, underVoiceVolume: 0.15,
    description: 'A small, clean mouth pop. An emoji or a word popping in.' },
  { id: 'pop-punchy', name: 'Punchy pop', category: 'pop', lengthSec: 0.1135, underVoiceVolume: 0.14,
    description: 'A short, punchy pop. A word or a number snapping onto the screen.' },
  { id: 'pop-bubble', name: 'Bubble pop', category: 'pop', lengthSec: 0.1135, underVoiceVolume: 0.15,
    description: 'A soft water-drop pop. Something small appearing: an emoji, a dot, a bubble.' },
  { id: 'ding-bell', name: 'Bell', category: 'ding', lengthSec: 1.8135, underVoiceVolume: 0.07,
    description: 'A bright bell ringing for almost 2 s. A reward or a right answer; it rings on under the next words. Never on bad news.' },
  { id: 'ding-glass', name: 'Glass ding', category: 'ding', lengthSec: 0.2735, underVoiceVolume: 0.097,
    description: 'A short glass tink. A small good moment: a check mark, a highlight landing.' },
  { id: 'ding-chime', name: 'Chime', category: 'ding', lengthSec: 0.5335, underVoiceVolume: 0.081,
    description: 'An upbeat confirmation chime: success, done. A good outcome, a tick on a list. Never on bad news or a sad line.' },
  { id: 'ding-double', name: 'Ding-ding', category: 'ding', lengthSec: 1.5135, underVoiceVolume: 0.11,
    description: 'A desk bell rung twice (1.5 s). "Order up", a call for attention; comic.' },
  { id: 'click', name: 'Click', category: 'click', lengthSec: 0.3135, underVoiceVolume: 0.3,
    description: 'A clean click, pressed then released 0.1 s later. A button pressed, something picked on screen.' },
  { id: 'click-mouse', name: 'Mouse click', category: 'click', lengthSec: 0.1535, underVoiceVolume: 0.37,
    description: 'A mouse click and its release. A cursor clicking something on screen.' },
  { id: 'click-double', name: 'Double click', category: 'click', lengthSec: 0.2935, underVoiceVolume: 0.39,
    description: 'A double mouse click.' },
  { id: 'tap', name: 'Tap', category: 'click', lengthSec: 0.0535, underVoiceVolume: 0.23,
    description: 'A fingertip tapping once on a hard surface, a low knock with a bright tick, very short. Words or items landing one after another, quick enough to repeat on each.' },
  { id: 'typing-key', name: 'Key press', category: 'typing', lengthSec: 0.2335, underVoiceVolume: 0.14,
    description: 'One key pressed. A single character, the enter key.' },
  { id: 'typing-short', name: 'Short typing', category: 'typing', lengthSec: 0.9135, underVoiceVolume: 0.16,
    description: 'About a second of typing. Text typed onto the screen.' },
  { id: 'typing-long', name: 'Long typing', category: 'typing', lengthSec: 2.9335, underVoiceVolume: 0.15,
    description: 'Three seconds of typing. Longer typed text; rarely under speech.' },
  { id: 'marker-swipe', name: 'Marker swipe', category: 'writing', lengthSec: 0.3335, underVoiceVolume: 0.12,
    description: 'A marker stroke on paper. A highlight sweeping over a word, an underline drawn.' },
  { id: 'marker-circle', name: 'Marker circle', category: 'writing', lengthSec: 0.5935, underVoiceVolume: 0.13,
    description: 'A marker drawing a circle. A word or a number circled by hand.' },
  { id: 'riser-short', name: 'Short riser', category: 'riser', lengthSec: 1.6135, underVoiceVolume: 0.079,
    description: 'Tension rising for 1.6 s, loudest at its end. Building into a reveal: it must end on the reveal, so place it that much earlier.' },
  { id: 'riser-hit', name: 'Riser into hit', category: 'riser', lengthSec: 2.8135, underVoiceVolume: 0.043,
    description: 'A riser that lands on a hit 1.5 s in. The hit goes on the reveal word, so place it 1.5 s before it.' },
  { id: 'riser-long', name: 'Long riser', category: 'riser', lengthSec: 3.2135, underVoiceVolume: 0.083,
    description: 'A long rise (3.2 s). A slow build into a big reveal; rarely.' },
  { id: 'impact-boom', name: 'Boom', category: 'impact', lengthSec: 1.8135, underVoiceVolume: 0.077,
    description: 'A deep cinematic boom that rings for almost 2 s. A dramatic reveal or a title slamming in; serious moments, once in a video at most.' },
  { id: 'impact-hit', name: 'Hit', category: 'impact', lengthSec: 0.7135, underVoiceVolume: 0.091,
    description: 'A dry, hard thwack. A punchline or a number slamming in.' },
  { id: 'impact-punch', name: 'Punch', category: 'impact', lengthSec: 0.6135, underVoiceVolume: 0.11,
    description: 'A heavy punch landing. A blunt truth, a knockout line; comic or dramatic.' },
  { id: 'glitch', name: 'Glitch', category: 'glitch', lengthSec: 0.4535, underVoiceVolume: 0.13,
    description: 'A digital glitch burst. A glitch transition or something breaking on screen; never on a clean, calm edit.' },
];
