# Pictures, footage and music found for the video

Read this before using a picture, a clip or a track that is not the person's own. Material is looked for when the person asks for it, never unasked (the `direction` guide). There are two kinds of found material, and they are used on different terms; a third source is a service the person has a key for.

## Free to reuse

Work that anyone may reuse, in a video that can earn money, and change: **public domain or CC0**, and **CC BY** (which asks for a credit). It suits any video, a business's included.

- Use it where the `direction` guide calls for a b-roll or a picture and the person asked you to look for one. Its credit goes in your answer (below).
- Never NonCommercial (NC), never NoDerivatives (ND: a crop or captions over it are changes), never ShareAlike (SA: it would put the person's video under the same licence).
- The licence is the file's, not the site's: read it on the file's own record. Free to look at is not free to use.
- Not even under a free licence: a private person who can be recognized, a logo or a product's packaging as the subject, anything that would suggest its source endorses the video.

## The internet's own material

Short videos are full of it: a meme, a reaction picture, a screenshot of the post or the headline being talked about, a frame of a film everyone knows, a picture of the product or the public figure the video is about. Creators use it as a quote or a joke, and it is part of the language of the feed. **It is not licensed.** Its owner can have the platform take the video down, and a business that uses it can be asked to pay for it.

- **Only on a creator's own channel**: a person speaking for themselves (most Casual and Playful videos, a Bold creator). Never on a video for a business, a brand or a client, an ad or a sponsored post: those take only what is free to reuse. When you cannot tell which it is, it is a business.
- **Only on the person's say.** Know that it is possible, and offer it where it would lift the video ("I can show the post you are answering, or the meme you mention; that is not licensed material, as with most of what creators use"). Use it when they ask for it or agree. Never decide it for them.
- **As a quote, not as the footage**: about what is being said at that moment, 2 to 3 seconds, the least that makes the point: the one post, the one frame. Never a whole clip, and never music from a commercial release: for a song, tell the person to add it in the app they post from, whose library is licensed for that.
- **Never**: a private person's picture, anything taken from behind a login or a paywall, a stock site's preview with its mark across it, or anything passed off as the person's own.
- **Say in your answer exactly which pieces are of this kind and where each came from**, so the person decides before they publish.

When nothing shows what the words name, say so and offer a drawn scene instead (the `graphics` guide). A loose match is worse than none.

## Where to look for what is free to reuse

Where the person tells you to, first. Left to you, anywhere that states each file's licence on the file's own record. Two wide places that ask for no sign-up, fetched with your own tools (the editor does not reach the internet):

- **Openverse**, for pictures of almost anything: the `images` search of its API (`api.openverse.org`, version 1) with `q=<words>&license=cc0,by&page_size=10`. Each result has the file (`url`), its `title`, `creator`, `license`, `license_url`, its page (`foreign_landing_url`) and the credit already written (`attribution`). Its `audio` search finds music the same way: search by feel and tempo, not by the video's subject, and take a track without words.
- **Wikimedia Commons**, for places, people in public life, art, science and history: its API gives each file's licence and author (`prop=imageinfo&iiprop=url|extmetadata`). It limits requests: a few, slowly.

## A service the person has a key for

Stock libraries and services that generate pictures or video give better material than free archives, and need a key. When the person has one and wants it used:

- The key is theirs: read it from where they say (an environment variable, a file they name), never write it into the project, a script kept in the folder, or your answer.
- Read the service's own documentation for the request, and make it with your own tools: a few requests by hand, or a small script in the folder beside the video when there are many. The editor only takes the files (`add_media`).
- Its terms are the person's to have accepted. Say in your answer what came from it, and for generated material that it is generated.
- What it returns is chosen and placed as any other material (below): looked at, judged by what it shows, of one kind.

## Choosing and placing

- It shows exactly what the words name, at the moment they name it. **Judge it by what it shows, not by what it is**: the viewer has three seconds and has not read the file's title. Search for what the word looks like, not for what is known about it, and take the picture a stranger would describe with the words being said.
- Large enough: a picture that covers the frame is at least 1080 pixels on its short side; one set over the video as a sticker, at least 600.
- Save each file in a folder beside the video, then `add_media` and `look_at_media` before placing it. Say what is in it in three or four words, as someone who knows nothing of where it came from: when those are not the words being said, it is out and you search again, or leave that moment to the speaker. Check too its shape, a stock site's mark or a caption burnt into it (then it is out).
- A still picture never sits still: once it is laid out, it takes a camera move on its layer for as long as it shows (`set_camera` on the layer), a slow push-in on a subject in the middle or a slow pan across a picture much wider than the frame, as the `direction` guide says.
- How many and where are the `direction` guide's: enough that no take of the video runs past the card's longest.

## The credits

- Keep a record as you go, one line per file: what it is, its author, its page, its licence and the licence's link.
- **Say them in your answer**, as a list the person can paste in the post's description, where links can be followed: each source with the link to its page and to its licence. Say that the licences were read from each file's record on the day, and that the person publishes under them; a CC BY piece asks for its credit where the video is posted. Material that is not licensed is listed apart, as such.
- **Nothing about credits goes on the video unless the person asks for it**: no line of sources on the last shot, no label on a picture. What is drawn on their video is theirs to decide.
