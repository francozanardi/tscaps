# Making a graphic

Read this, with the `graphics` guide, before adding a graphic or changing one: how to pick or write it, place it, time
it to the words and check it until it is right. A graphic already on the video is changed with `edit_graphic`, from
what it is now (`get_element` gives its code; the person may have changed it); never add a second one in its place.

## How you work

1. **Pick or write.** A request that names a preset, or asks for what a preset's family is for (a hook, a speaker's name,
   a call to action), takes that preset: `list_catalog` with `graphic_presets` for the ids and fields, then
   `add_graphic` with `preset` and `params`. A preset keeps its own look, plate or card included: the guide's
   editorial look is for the graphics you write, and you change a preset's look only where the person asks. Anything
   else, and every key moment, you write yourself, in the guide's editorial look. When the request is about a graphic
   already there, change that graphic with `edit_graphic` and add none. A preset's entrance or exit is set with
   `set_element_animation` on its layer (`list_catalog` with `layer_motions`).
2. **Place it** where the frame has room. For a graphic you write, look at the shot first (`render_frames` at its start
   and middle; a preset keeps the place it comes with unless the person asks to move it) and put the
   box beside or above the speaker, clear of the face and of the captions. A b-roll meant to cover the frame
   or half of it is added in a box, then laid out with `set_layer` (`full` or `split`) once it paints its whole box.
3. **Time it to the words.** The graphic's clock starts when the shot it opens on starts (`get_project` gives the
   shots, `get_transcript` with `detail: "timed"` the words): a word said at X s is at t = X − that start. Land what matters on its word, hold it long enough to read (the guide's rule), and declare that moment
   with `tscaps.moment` so a sound can go on it.
4. **A preset as it is takes one look.** A preset placed with its fields set and its code untouched is tested
   already: read the warnings `add_graphic` answers, then `render_frames` once, at a moment it has landed, and check
   only what its fields and its place decide (the words it shows, where it sits, its size). Fix those and look once
   more; anything else of a preset is as it was made. Change a preset's code (its look, its motion) and it is a
   graphic you wrote: check it as below.
5. **Check what you write, every time you change it.** Read the warnings `add_graphic` and `edit_graphic` answer (the code threw,
   the graphic drew nothing, it leaves its b-roll part see-through, its text is cut or too small once landed: these
   last two are measured on the page itself, so trust them over what a picture seems to show) and fix those first. Then look:
   - `render_frames` at the start of the entrance, mid-entrance, once it has landed, and late in its time;
   - then the same moments zoomed on the graphic: `region` around its box with some margin (the box's centre and width
     come in shares of the frame; its height is its width × the frame's width ÷ the frame's height ÷ its
     aspectRatio).
   On the zoomed pictures, check each of these and fix what fails:
   - every word is there, whole, and readable on a phone: none cut by the box's edge, none overflowing. The guide's
     minimum size is a floor, not a target: anything meant to be read sits well above it;
   - nothing is clipped: no straight line where a shadow or a glow stops at the box's edge (more padding, a wider
     aspectRatio);
   - it is where it should be: inside the frame, on the side with room, clear of the face and of the captions. That
     is the default, not a rule: when the person asks for it over the face or the captions, or that small, do as
     asked;
   - it moves as asked, and is still once landed;
   - it looks designed, as the guide's look says, not like a web page.
   Change only what fails, then look again at the moments it touches.
6. **Done** once it passes, or once you cannot get it further: say what it shows and when, and anything still wrong
   or not possible (a look asked for that the `graphics` guide rules out).

## Around the graphic

When the graphic needs a shot of its own (to start or end on a word), split the shots first (`split_shots` with
`beforeWords`). A sound on its landing moment makes it land harder: the `sound` guide.

