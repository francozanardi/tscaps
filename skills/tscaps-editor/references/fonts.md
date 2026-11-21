# Fonts

The fonts tscaps has, for a caption's CSS and for a graphic. Write the name exactly as here, quoted, with a generic fallback after it: `font-family: 'Anton', sans-serif`. Any other name is drawn by each device with a font of its own, and the export can differ. In a graphic, a family whose name ends in `Variable` also answers without it (`'Inter'`); in a caption's CSS it does not.

## Weights and italics

- A family whose name ends in `Variable` takes any weight in its range, given below.
- Poppins: 400, 700, 800. Roboto, Kalam, Tajawal, Amiri: 400 and 700. Every other family: 400 only. Do not ask those for bold: the browser fakes it by smearing the letters.
- A true italic: only Fraunces Variable and EB Garamond Variable. Anywhere else `font-style: italic` slants the upright letters; for a written look, use a handwritten family instead.

## Latin, by use

- Sans: Inter Variable (100–900), Montserrat Variable (100–900), Poppins, Roboto, Bricolage Grotesque Variable (200–800, characterful), Manrope Variable (200–800), DM Sans Variable (100–1000), Raleway Variable (100–900), Gabarito Variable (400–900), Nunito Variable (200–1000, rounded), Comfortaa Variable (300–700, rounded).
- Condensed and display: Anton, Bebas Neue (capitals only), Oswald Variable (200–700), Bangers and Komika Axis (comic), Bungee, Righteous.
- Serif: Playfair Display Variable (400–900), Fraunces Variable (100–900), EB Garamond Variable (400–800), Lora Variable (400–700), DM Serif Display, IM Fell English (old print).
- Handwritten: Caveat Variable (400–700), Kalam, Dancing Script Variable (400–700, joined script), Pacifico, Lobster, Permanent Marker (marker pen).
- Mono and pixel: JetBrains Mono Variable (100–800), VT323, Press Start 2P.

## Pairs for two voices

For text that sets one line against another (a caption's setup and payoff, a title and its subtitle). What makes a pair:

- **Contrast of kind, not only of weight**: one voice delicate (a script, a hand, a classic serif or its italic), the other heavy (a black grotesque, condensed capitals). The same family at two weights is the quiet version.
- **Contrast of scale**: the big voice two to three times the small one, the small one set tight over or under it, close enough that the two read as one block.
- **Either voice can be the big one.** A small sans over a huge italic serif reads as editorial as a small serif over heavy capitals.
- **No outline on the delicate voice.** Fine strokes clog under one; a soft shadow keeps it readable on video.

These hold together, the first the safest:

| Delicate voice | Heavy voice | Reads as |
|---|---|---|
| Fraunces Variable, 400 to 500, italic or upright | Montserrat Variable, Poppins or Inter Variable, 800 to 900 | warm and editorial, on almost any video |
| EB Garamond Variable italic, or Fraunces Variable italic, very large | Inter Variable, 600, small, over it | the scale reversed: editorial, for a serious or professional video |
| EB Garamond Variable or Lora Variable, 400 to 500 | Anton or Bebas Neue, in capitals | classic over condensed capitals: cinema, sport, a bold video |
| Lora Variable, 500 | Nunito Variable, 800 | soft, for a tender video |
| Dancing Script Variable, Caveat Variable or Permanent Marker, small | Bricolage Grotesque Variable, Montserrat Variable 900, Anton or Bebas Neue | a script or a hand: only for a playful video, and on a line or two rather than as the kit's delicate voice; it reads as a gimmick sooner than a serif does |

- An italic: Fraunces Variable or EB Garamond Variable, the two with a true italic. Any other only slants.
- A serif with fine strokes (Playfair Display) wants size and no outline; a sturdier one (Fraunces, DM Serif Display, Lora) holds up better at small sizes.

## Other alphabets

A family draws only its alphabets. A letter it lacks goes to the next family in the list, so for text that mixes alphabets name one family for each, in order: `font-family: 'Anton', 'Cairo Variable', sans-serif`. The families for each alphabet (`Variable` left out):

- Cyrillic: Inter, Montserrat, Roboto, Manrope, Nunito, Raleway, Comfortaa, Oswald, EB Garamond, Lora, Lobster, Caveat, JetBrains Mono, Press Start 2P.
- Greek: Inter, Roboto, Manrope, Comfortaa, EB Garamond, JetBrains Mono, Press Start 2P.
- Devanagari: Poppins, Kalam.
- Arabic and Persian: Vazirmatn, Cairo, Noto Sans Arabic, Noto Kufi Arabic, Tajawal, Lalezar (display), Amiri (serif).
- Urdu: Noto Nastaliq Urdu, which needs much more line height (about 2), or any Arabic family above, in Naskh.
- Hebrew: Heebo, Assistant, Rubik.
- Bengali: Noto Sans Bengali, Noto Serif Bengali.
- Telugu: Noto Sans Telugu, Noto Serif Telugu.
- Tamil: Noto Sans Tamil, Noto Serif Tamil.
- Thai: Noto Sans Thai, Noto Serif Thai.
- Chinese, Japanese, Korean: none. The device draws them (`sans-serif` or `serif`), so the export can differ.
- Emoji: the device's colour emoji font.

Arabic, Persian, Urdu and Hebrew read right to left: in a graphic, give their text `dir="rtl"`.
