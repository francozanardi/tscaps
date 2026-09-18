# Tscaps Built-in Templates Catalog

Use any of these 38 built-in `templateId` values when creating video automation jobs via `POST /v1/automation-jobs`.

Each template defines a distinct typographic voice, layout geometry, entrance animation, and active-word highlighting behavior.

To modify an existing style or create a custom template (with your brand colors, fonts, or layout), design and save it in the web editor at `https://tscaps.io/app/projects`, then copy its ID from `https://tscaps.io/app/developers/templates`. Custom template IDs can be used in `templateId` just like built-in templates.

---

## Modern

- `cleo` (Lora, serif): Single-line literary serif in natural casing. Calm settle-in transition, with dedicated color for quoted speech, italicized entity accents, and bold weight (900) on emphasized words.
- `enzo` (Inter, ultra-bold): Heavy sans-serif with a crisp upward shadow lift. Words fade in on narration, while AI-emphasized words and entities switch to an italic serif (EB Garamond) scaled up with a luminous accent halo.
- `hugo` (Gabarito, uppercase): Bold geometric uppercase formatted in balanced 2-line blocks. Spoken words land with a dynamic flash-in effect, accompanied by a soft radial halo bloom and dedicated accent-color highlights.
- `mira` (Montserrat, clean): Single-line modern geometric sans-serif in natural casing with a black outline and soft drop shadow. Enters with a subtle settle-in slide, featuring italicized gold quotes and bold emphasis words.
- `noor` (Anton, gold display): Massive single-line uppercase filled with a warm gold gradient. Features a golden halo glow, subtle settle-in entrance, green quotes, and white-gold emphasized words.
- `nova` (Poppins, dual-line): Two-line geometric sans-serif with an intentional size hierarchy: line 1 is 1.5x larger in bright yellow, while line 2 is white. Lines enter with an upward deblurring rise.
- `sara` (IM Fell English, antique serif): Historic literary serif with multi-layered soft bloom and shadow. Spoken words fade in gently, with emphasized words scaling up 1.4x for visual contrast.
- `selene` (Montserrat, frosted glass): Clean sans-serif set inside a translucent frosted glass capsule that blurs and saturates the video footage behind it.
- `sol` (Montserrat & Kalam, dual-font): Two-line pairing featuring thin minimalist sans-serif on top, followed by a larger golden handwritten script (Kalam) on the bottom line with a warm glow and bouncy pop-in reveal.

---

## Viral

- `freya` (Anton, uppercase): Heavy condensed uppercase with tight line spacing and contextual emojis by default. Features an entry chromatic glitch burst with active word highlighting and stripped punctuation.
- `ivo` (Anton, uppercase): Dual-line label pills in condensed uppercase. Features a solid black top bar and an overlapping crooked lime tape strip tilted at -2 degrees with wobble-in entrance motion.
- `juno` (Bungee, uppercase): Chunky retro italic display with elastic pop-in bounce. Features a multi-layered 3D shadow extrusion with bright yellow active-word highlights.
- `kai` (Bricolage Grotesque, uppercase): Single-line expressive grotesque in heavy uppercase. Words activate from dim 55% opacity into full white with an energetic chromatic jitter shake animation.
- `lewis` (Gabarito, single-word): Ultra-bold single-word display with rapid pop-in scaling, black stroke outline, and contextual emojis by default. Features dual-layer backlighting with cyan highlights on key words and neon green on rhythm accents.
- `loki` (Komika Axis, comic display): High-energy comic book uppercase with an elastic scale-in bounce. Features a thick black outline and deep drop shadow with vibrant yellow active-word highlighting.
- `naya` (Anton, uppercase): High-impact condensed uppercase with a thick black outline and animated contextual emojis floating above the text by default. Active words pop in with bright neon yellow highlights.
- `pepper` (Anton, highlight pill): Condensed uppercase with black outlines. Spoken words trigger an animated terracotta-orange pill that smoothly grows behind the active word.
- `remi` (Caveat, bouncy script): Large handwritten cursive script. Words snap into place one by one with a bouncy rotational pop, highlighting in warm pastel gold as spoken.
- `tala` (Anton, tape strip): Single-line condensed uppercase inside a dark tape pill. When emphasis words occur, the entire strip inverts into high-contrast yellow with black text.
- `tito` (Bungee, arcade wave): Chunky retro display font with isometric drop shadows. Words animate in a staggered wave-bob motion, with active words lighting up in glowing neon mint.
- `zara` (Anton, chromatic glitch): Cyberpunk-style condensed uppercase with vibrant magenta and cyan RGB split ghosting. Features a twitchy glitch-in entrance with electric yellow active-word highlights.

---

## Key Moments

- `elio` (Bebas Neue, uppercase): Tall condensed display centered on the frame (2 to 6 lines). Words rise in vertically as they are spoken, with size and weight boosts on emphasized terms.
- `levi` (Anton, uppercase): Heavy condensed uppercase arranged in a tall, narrow column (4 to 8 stacked lines). Uses a subtle vertical gradient fill with soft drop shadow, fading in line-by-line.
- `luca` (Caveat, script): Handwritten cursive script combined with an oversized, bold uppercase anchor word (Anton) that blends into the video footage. Lines slide in dynamically at speech pauses with soft drop shadows.
- `luna` (Poppins, uppercase): Bold geometric uppercase positioned on the upper-left. Uses an inverting difference blend mode that creates a negative cutout over the video, with words revealing via a crisp vertical rise.
- `milo` (Lobster, script): Retro cursive script paired with an oversized, bold uppercase anchor word (Anton) that inverts the video footage beneath it. Words slide in directionally from opposite sides after pauses.
- `pastor` (Manrope, behind-actor): Single-line gold sans-serif that dynamically expands into giant Anton uppercase behind the presenter, spanning the video width with deep drop shadows.

---

## Classic

- `anya` (Playfair Display, italic serif): Bold italic serif with high contrast in natural casing. Uses a warm cream palette with subtle shadow, transitioning spoken words with a gentle gold highlight-pulse.
- `kel` (JetBrains Mono, monospace): Code-editor monospaced typography inside dark rounded background strips. Active words shift to syntax-blue highlights with a deep navy background on peak emphasis words.
- `otto` (Inter, closed-caption): Standard broadcast-style subtitle in natural casing set inside a rounded black background pill. Spoken words highlight in warm gold.
- `theo` (Inter, classic karaoke): Traditional broadcast-style karaoke subtitle on a translucent dark backplate. Upcoming words are dimmed grey, the active spoken word highlights in gold, and past words remain clean white.
- `vera` (Inter, corporate pill): Professional business-style subtitle on a translucent dark backing strip. Spoken words are highlighted by a clean, vibrant blue pill that lands behind the active word.
- `yuki` (Inter, minimal classic): Pure, distraction-free white subtitles in natural casing with a subtle drop shadow and a gentle fade-in entrance.

---

## Lab

- `iris` (Righteous, display): Geometric retro display font with heavy black stroke outlines. Renders over a textured watercolor marker stroke backdrop that cycles through pastel highlight palettes.
- `lena` (Inter, chat bubbles): iOS-style blue message bubbles stacked on the left side of the screen with an authentic speech bubble tail. Each line animates in with a gentle spring rise, supporting emojis and italic quotes.
- `lyra` (Bricolage Grotesque, gradient): Single-line heavy grotesque with an animated multi-color gradient shimmer flowing through the letters. Features vibrant pastel and neon color palettes.
- `nyx` (VT323, retro terminal): Floating terminal window with title bar and traffic light dots. Features glowing green phosphor pixel text typed out letter-by-letter with an active block cursor.
- `pico` (JetBrains Mono, code editor): Floating code-editor window complete with title bar, traffic light dots, and left gutter line numbers. Monospaced text types out letter-by-letter with a thin blinking editor caret.
