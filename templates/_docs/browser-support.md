# Browser support

What each browser engine gets wrong with templates, what to do about it while you write one, and
why every template that opts out of a browser does so. Read it before you ship a template, and
add to it when you find something new: the next author should not have to rediscover it.

A template renders in three engines, and each one is a separate place it can break:

| Engine | Browsers |
|---|---|
| Blink | Chrome, Edge, Opera, Brave, Arc, Chrome on Android |
| Gecko | Firefox on desktop and Android |
| WebKit | Safari on macOS, and **every** browser on iPhone and iPad, Chrome and Firefox included |

Chrome is the reference: a template is designed and checked there first, and a difference
elsewhere is a bug in that browser until shown otherwise.

**Look at the screen, not at an element screenshot.** Safari draws WebDriver's element screenshot
apart from what it shows on screen: a blend that is lost on screen can still look right in it. Cut
captures out of a screenshot of the whole window.

**Check the export, not only the preview.** The preview is the live page; the export draws the
same captions through an SVG image, one frame at a time, and several of the problems below show
up only there. Check both in each engine, with a two-line caption, a word that pops, and an emoji
if the template shows emojis.

## When a browser cannot render a template

Design around the problem first; most entries below say how. When there is no way around it,
declare the browser in `unsupportedBrowsers` rather than ship a broken picture. The template
disappears from the gallery there, and a saved project that uses it tells the person their
browser cannot render it. → [template-json.md](template-json.md)

| Slug | Means |
|---|---|
| `firefox` | Firefox (Gecko). Firefox on iPhone is WebKit and is not covered by it |
| `safari` | Every WebKit runtime: Safari, and every browser on iPhone and iPad |
| `safari-before-26` | Only WebKit older than release 26: Safari 18 and older, and every browser on iOS or iPadOS 18 and older |
| `chrome`, `edge`, `opera` | Those Blink browsers by name |

Declare the narrowest slug that covers the break. A template that works from WebKit 26 on names
`safari-before-26`, not `safari`.

Then add the template to [the table at the end](#templates-that-opt-out), with the reason.

## WebKit: Safari, and every browser on iPhone and iPad

**A text shadow vanishes when the outline is painted first and is zero wide.** With
`paint-order: stroke fill` and a `-webkit-text-stroke` of `0`, Safari drops the `text-shadow`, so
a glow or a soft shadow is gone in the preview and weaker in the export. Paint the stroke first
only while it is wider than zero; at zero, leave `paint-order` at `normal`. Seen on hugo, sara,
cleo and enzo, whose outline defaults to zero.

**A blend against the video is lost in the preview once the word's entrance ends.** A word with
`mix-blend-mode` over the video blends while its entrance animation runs and turns solid (white,
for milo, luca and luna) once it ends. Give the blending element a compositing layer of its own
with `will-change: opacity`; Chrome and Firefox render the same with it. Text filled with
`background-clip: text` needs it as much as plain text: suki's large word stays its own colour in
Safari without it. Seen on milo, luca, luna and suki.

**A filter on the segment or the line does not reach a word whose transform is animating.**
Safari paints the moving word on a layer of its own, so under an outlined segment the word
popping in shows bare until its animation ends. Put the filter on the element that moves.
→ [filters.md](filters.md#cross-browser). Seen on naya.

**A filter on the video-frame layer escapes its rounded parent in the export.** Give the layer
`transform: translateZ(0)` beside the filter. → [rendering.md](rendering.md). Seen on selene.

**A weight the font does not ship is synthesized much heavier.** Asked for a bold the face does
not have, every browser fakes one, but Safari thickens the glyphs about two and a half times as
much as Chrome (ink +24% over the real weight, against +9.5% in Chrome and +7.6% in Firefox): the
letters come out wider, counters close up, and a thin outline drawn with the text is swallowed.
Ask only for weights the face ships; Anton, for instance, has 400 and nothing else. Seen on levi
(800) and noor (900), which now ask for 400. milo still asks Lobster, another single-weight face,
for 600; in Safari its letters come out only slightly heavier.

**WebKit 18 and older leaves the video frame out of the export.** A template with
`videoFrame.required` paints the video behind its captions through an image inside the SVG the
export draws, and WebKit before release 26 leaves that image out of the first draw of every
sheet, whatever the markup; a large one is never painted. There is nothing to design around:
declare `safari-before-26`. Every template with `videoFrame.required` does.

**`feDisplacementMap` and `feTurbulence` have dropped output in Safari before.** Test a filter
that leans on them there. → [filters.md](filters.md#cross-browser)

## Gecko: Firefox

**Text filled with `background-clip: text` can disappear from the export.** The export waits for
each frame's captions to be drawn before it takes the frame, and with `background-clip: text`
Firefox sometimes reports them drawn before the fill is painted: those frames come out with the
captions missing, or partly missing, or in the wrong colour. It is a race, so how many frames it
takes changes from run to run, and the preview is never affected. Measured in exports of a
five-second clip (120 frames) in Firefox 158 on macOS:

| Template | Frames that lost their captions |
|---|---|
| levi | 116 |
| noor | 31 |
| lyra | 8 |
| apollo | 8 |
| nina | 12 |
| pippa | 14 (the highlight stays, the words go) |
| suki | 16 (the large word goes or turns another colour) |

There is no fix on the template's side yet: a template that fills text with
`background-clip: text` declares `firefox`.

## Windows

**Windows 10 draws every emoji with a dark outline of its own.** An outline filter that also
covers the emoji adds a second one, which reads as a heavy black border. Outline the words, not
the segment the emoji live in. Seen on naya and freya.

Emoji are drawn by the operating system's emoji font, so they differ by system, not by browser:
Apple Color Emoji on macOS and iOS, Segoe UI Emoji on Windows, Noto Color Emoji on Linux and
Android. That is expected and not a reason to opt out.

## Templates that opt out

| Template | Declares | Why |
|---|---|---|
| levi | `firefox` | `background-clip: text` loses captions in the export |
| lyra | `firefox` | `background-clip: text` loses captions in the export |
| noor | `firefox` | `background-clip: text` loses captions in the export |
| apollo | `firefox` | `background-clip: text` loses captions in the export |
| nina | `firefox` | `background-clip: text` loses captions in the export |
| pippa | `firefox` | `background-clip: text` loses captions in the export |
| suki | `firefox`, `safari-before-26` | `background-clip: text`; `videoFrame.required` |
| luna | `safari-before-26` | `videoFrame.required` |
| milo | `safari-before-26` | `videoFrame.required` |
| luca | `safari-before-26` | `videoFrame.required` |
| selene | `safari-before-26` | `videoFrame.required` |
| theo | `firefox` | A gradient that rendered wrong in the export. theo has no gradient today; worth testing again |
