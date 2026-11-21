const headline = document.querySelector('.headline');
const text = String(tscaps.params.headline).trim();
const phrase = String(tscaps.params.highlight).trim();
headline.style.setProperty('--marker', tscaps.params.marker);
// Two lines of about thirty characters at full size; a longer headline keeps its area and shrinks.
headline.style.setProperty('--size', `${Math.min(21, 21 * Math.sqrt(30 / Math.max(1, text.length)))}vh`);

// The highlighted phrase, wherever it sits and in any case.
const at = phrase === '' ? -1 : text.toLowerCase().indexOf(phrase.toLowerCase());
const words = [];
const marked = [];
const addWord = (piece, highlighted) => {
  const word = document.createElement('span');
  word.className = 'word';
  if (highlighted) {
    word.classList.add('marked');
    const ink = document.createElement('span');
    ink.className = 'ink';
    ink.textContent = piece;
    const swept = document.createElement('span');
    swept.className = 'swept';
    swept.textContent = piece;
    swept.setAttribute('aria-hidden', 'true');
    word.append(ink, swept);
    marked.push({ ink, swept });
  } else {
    word.textContent = piece;
  }
  headline.append(word);
  words.push(word);
};
const addPart = (part, highlighted) => {
  for (const piece of part.split(/(\s+)/)) {
    if (piece === '') continue;
    if (/^\s+$/.test(piece)) headline.append(' ');
    else addWord(piece, highlighted);
  }
};
if (at === -1) {
  addPart(text, false);
} else {
  addPart(text.slice(0, at), false);
  addPart(text.slice(at, at + phrase.length), true);
  addPart(text.slice(at + phrase.length), false);
}
for (const { ink } of marked.slice(0, -1)) ink.parentElement.classList.add('joined');

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);
const easeInOut = (x) => (clamp(x) < 0.5 ? 2 * clamp(x) ** 2 : 1 - (-2 * clamp(x) + 2) ** 2 / 2);

const WORD_STAGGER_SEC = 0.07;
const WORD_SEC = 0.32;
// The marker sweeps once the words have landed, word after word across the phrase. It takes the same time
// whatever the phrase's length, so a sound placed on `highlight` (the bundled marker swipe is about as long)
// stays in step with it: a long phrase is swept faster, not for longer.
const SWEEP = Math.min(0.9, 0.2 + words.length * WORD_STAGGER_SEC);
const SWEEP_SEC = 0.35;
// How far past a word's box its shadow and its descenders reach.
const OUTSET = '-0.6em';
// Each word's share of the sweep follows its length, so the marker moves at an even speed across the phrase.
const reach = marked.map(({ ink }) => ink.textContent.length + 1);
const totalReach = reach.reduce((sum, length) => sum + length, 0);
if (marked.length > 0) tscaps.moment('highlight', SWEEP, 'Marker sweeps');

tscaps.render = (t) => {
  words.forEach((word, index) => {
    const landed = easeOut((t - index * WORD_STAGGER_SEC) / WORD_SEC);
    word.style.opacity = String(clamp((t - index * WORD_STAGGER_SEC) / 0.12));
    word.style.transform = `translateY(${(1 - landed) * 0.35}em)`;
  });
  // How far along the phrase the sweep is, in characters, split across its words in order.
  let before = 0;
  const reached = easeInOut((t - SWEEP) / SWEEP_SEC) * totalReach;
  marked.forEach(({ ink, swept }, index) => {
    const share = clamp((reached - before) / reach[index]) * 100;
    before += reach[index];
    // Each copy is cut only along the marker's edge: the other sides reach past the box, so the words' shadow
    // and their descenders are never clipped into a visible rectangle.
    swept.style.clipPath = `inset(${OUTSET} ${100 - share}% ${OUTSET} ${OUTSET})`;
    ink.style.clipPath = share > 0 ? `inset(${OUTSET} ${OUTSET} ${OUTSET} ${share}%)` : 'none';
  });
};
