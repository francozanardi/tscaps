const card = document.querySelector('.card');
const textBox = document.querySelector('.text');
const text = String(tscaps.params.text).trim();
const phrase = String(tscaps.params.highlight).trim();
card.style.setProperty('--accent', tscaps.params.accent);
card.style.setProperty('--card', tscaps.params.card);
// Two lines of about fifteen characters at full size; a longer hook keeps its area and shrinks.
card.style.setProperty('--size', `${Math.min(22, 22 * Math.sqrt(30 / Math.max(1, text.length)))}vh`);

// The words, the highlighted phrase (wherever it sits, any case) in the accent colour.
const at = phrase === '' ? -1 : text.toLowerCase().indexOf(phrase.toLowerCase());
const words = [];
const addPart = (part, accented) => {
  for (const piece of part.split(/(\s+)/)) {
    if (piece === '') continue;
    if (/^\s+$/.test(piece)) { textBox.append(' '); continue; }
    const word = document.createElement('span');
    word.className = accented ? 'word accent' : 'word';
    word.textContent = piece;
    textBox.append(word);
    words.push(word);
  }
};
if (at === -1) {
  addPart(text, false);
} else {
  addPart(text.slice(0, at), false);
  addPart(text.slice(at, at + phrase.length), true);
  addPart(text.slice(at + phrase.length), false);
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

const WORD_STAGGER_SEC = 0.06;

// The card settles in from a little smaller; its words rise into it one after another.
tscaps.render = (t) => {
  const shown = easeOut(t / 0.35);
  card.style.opacity = String(clamp(t / 0.15));
  card.style.transform = `translateY(${(1 - shown) * 6}vh) scale(${0.9 + 0.1 * shown})`;
  words.forEach((word, index) => {
    const landed = easeOut((t - 0.12 - index * WORD_STAGGER_SEC) / 0.3);
    word.style.opacity = String(clamp((t - 0.12 - index * WORD_STAGGER_SEC) / 0.12));
    word.style.transform = `translateY(${(1 - landed) * 0.4}em)`;
  });
};
