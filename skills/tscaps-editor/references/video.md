# The video: shots, layers, camera, transitions, sounds, cuts

## Shots

- The timeline is split into shots; each runs until the next one starts. Until the person edits them, the editor proposes shots from the speech; editing one makes them all real (their refs stay the same).
- `split_shots` opens new shots before given words (the cut lands in the silence before the word, as the editor's own split does) or at given times; `join_shots` merges a shot into the one before it. Split where something should start or stop: a b-roll from 4.2 s to 7.8 s is two splits and a layer on the shot in between.
- A transition belongs to one shot. A layer or a camera opens with one shot and ends with it, unless it is told to run through a later one (`through`, below). Pick shot boundaries on speech pauses or between sentences, so a change does not cut a word in half.
- A split never shortens what is already there: a layer goes on showing over both halves, and a camera move runs on over both as one move. To end one at the split, set `through` to the first half (`set_layer` for a layer, `set_camera` for the camera). A punch-in or a framing is given to each half as its own: change or take it off on the half itself. So split first, then place.

## Layers

- `place_media` puts one of the person's files (`list_catalog` with `media`) on a shot: a video becomes the shot's b-roll, a picture or GIF goes on top. When the person has none, offer to draw the b-roll as a graphic where code can show it (a chart, a diagram, a title card: `add_graphic`, after the `graphics` guide), or to look for pictures or footage under a free licence, credited (the `sourcing` guide): the editor itself does not reach the internet.
- `set_layer` changes a layer's layout: `full` (covers the frame), `split` (shares the frame with the speaker, side by side or top and bottom), `inset` (a box over the video, like a picture in picture). A graphic takes `full` or `split` only as a b-roll that paints all of it; anything set over the video stays `inset`. For a video file, `timing` picks which part of the file plays.
- Entrance and exit motions of a layer: `set_element_animation` on the layer with scope `entrance` or `exit` (`list_catalog` with `layer_motions`).
- `remove_layers` removes them.
- **Most layers belong to one shot.** `through` (on `place_media`, `add_graphic` and `set_layer`) names the last shot a layer shows on, for what should stay on screen while the picture under it changes: a name card across a speaker's answer, a b-roll under several beats, a progress bar or a logo over the whole video (on the first shot, `through` the last one). It is one layer: it enters once, where its own shot opens, and leaves once. To have it start on another shot, move it with `set_layer` `shot`. Never put a copy of the same thing on each shot of a stretch: every copy enters again at its cut.
- Do not stretch a layer over shots to save a split: where it should end, there should be a cut. A shot's own layers are drawn above the ones still showing from earlier shots; graphics stay above every file. `get_project` lists, under `continuing`, what still shows on a shot from before it.

## Camera

- `set_camera` moves the camera over a shot's video (target `shot:N`) or a layer: a preset (`list_catalog` with `camera_moves`: punch in, slow push in, zoom in, pan...) and where to aim it. `scale` 1 is no zoom; 1.2 is a gentle punch in; above 1.6 is strong. On a reframed video leave `x` and `y` out: the move keeps aiming at what the shot was framed on.
- A punch in on the shot that holds the key sentence is the classic way to add emphasis. Do not zoom every shot: contrast is what makes it work.
- A camera preset adds its own sound by default.
- A camera runs for its shot. To run one move across several shots (a slow push over a long answer while graphics come and go), give `set_camera` the last of them as `through`: the shots in between show that camera and none of their own. It stops before a shot that has a camera or a framing of its own; `get_project` says `cameraFrom` on a shot another shot's camera runs over. A punch-in given `through` goes on every shot up to that one as its own, framed shots included, each aimed where it already looks: one call for a zoom held over several shots.

## Transitions

- `set_transition` sets how the picture passes into a shot from the one before: blur, whip, spin, glitch, flash, fades, wipe, iris... 0.2 to 1.5 s. In an edit of the whole video they go into and out of a b-roll that takes the whole frame, and nowhere else, in the one kind the `direction` guide's card names (`blur` or `whip`): a cut between two shots of the speaker stays a plain cut.

## Sounds

- Sound effects mark what appears or moves; in an edit of the whole video, the `direction` guide's card says which and how many. A graphic preset or a camera move that brings its own sound is fine; keep that one. Read the `sound` guide first; `add_sounds` places bundled effects (`list_catalog` with `sounds`: what each sounds like and suits) on an emoji, a graphic's moment, a layer's entry or exit, a shot, a word (it moves with the word), or a time, each at the level that sits it under the voice.

## Colour and frame

- `set_color_grade`: a look (`list_catalog` with `looks`) and fine adjustments, each from -1 to 1 (vignette 0 to 1). Subtle values (0.1 to 0.3) look professional; strong ones look like a filter.
- The shape of the frame: 9:16 for Reels, TikTok and Shorts; 1:1 and 4:5 for feeds; 16:9 for YouTube. Changing it re-lays the captions: read the transcript again afterwards, segment and line refs change.

### Changing the shape of the frame

- **To fill a frame of another shape, call `reframe_video`** (a wide video made vertical, most often). The editor finds the takes of the video (stretches filmed without a cut) and the people in each, splits shots at the video's own camera changes, and frames each shot by measure on its person: centred, the head a third of the way down, closer where they are small in the picture. What it cannot measure is whom to show where a take holds several people: called with only `format` on such a video it changes nothing and answers the takes with pictures of them, the people lettered. Call it again with `plan`, every choice in one call: whoever is speaking in each of those takes, a switch where the speaker changes inside one, and a point (`at`) for a take whose subject is an object off the middle of the picture. Its answer says what each part shows and holds pictures of it as it exports: look at them. Where the person of a part walks out of its framing, that part's camera follows them (`follows` in the answer); a camera move given to such a shot afterwards does not play, only how close it holds. Do it first in an edit, before hooks and zooms: everything after is placed in that frame.
- When the person wants something else in some shots ("show the guest", "keep the product in frame"), or a part of the result does not show its subject well, call `reframe_video` again with `onlyPlanned: true` and a `plan` entry for each of those takes: another person, a point with `at`, another `closeness`. Do not aim shots by hand.
- `set_output_frame` is for the rest: the whole picture fitted over a blurred or black backdrop (`fit: "fit"`, only when the person asks for it), the original shape, or one crop for the whole video when the person asks for exactly that (`cropX`).

## Cuts

- Every change to the cuts (pauses, fillers, false starts, retakes, a stretch by time, a cut brought back) is `cut_video`, after reading the sound with `get_audio`. Read the `cuts` guide first: it says what a video takes and how to cut cleanly. Times stay on the original timeline: cutting does not change the times of the words you read.
- A cut takes its captions with it. `delete_words` is the other way round: it takes words out of the captions and leaves the video saying them.
- In a whole-video edit, cut what stalls a video that takes cuts (the `cuts` guide says which do), and say what you cut: a cut changes what the person hears, and they may want it back.
