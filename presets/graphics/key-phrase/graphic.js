const phrase = document.querySelector('.phrase');
const before = document.querySelector('.before');
const key = document.querySelector('.key');
const after = document.querySelector('.after');
const text = String(tscaps.params.text).trim().replace(/\s+/g, ' ');
const keyWords = String(tscaps.params.key).trim().replace(/\s+/g, ' ');
phrase.style.setProperty('--accent', tscaps.params.accent);

// The key words wherever they sit in the phrase, in any case; without them, the whole phrase is the key.
const at = keyWords === '' ? -1 : text.toLowerCase().indexOf(keyWords.toLowerCase());
const beforeText = at === -1 ? '' : text.slice(0, at).trim();
const keyText = at === -1 ? text : text.slice(at, at + keyWords.length);
const afterText = at === -1 ? '' : text.slice(at + keyWords.length).trim();

const wordsOf = (line, words) => words.split(' ').filter((word) => word !== '').map((piece, index) => {
  const word = document.createElement('span');
  word.className = 'word';
  word.textContent = piece;
  if (index > 0) line.append(' ');
  line.append(word);
  return word;
});
const leadWords = wordsOf(before, beforeText);
key.textContent = keyText;
const trailWords = wordsOf(after, afterText);
before.style.display = beforeText === '' ? 'none' : '';
after.style.display = afterText === '' ? 'none' : '';

// Each lead line on one row while it is short, on two once it is long; the key words as large as fit one row.
const leadLength = Math.max(beforeText.length, afterText.length, 1);
const leadRows = leadLength > 24 ? 2 : 1;
phrase.style.setProperty('--lead-size', `max(8vh, min(16vh, calc(90vw * ${leadRows} / (${leadLength} * 0.56))))`);
phrase.style.setProperty('--key-size', `min(${beforeText === '' && afterText === '' ? 46 : 40}vh, calc(90vw / (${Math.max(1, keyText.length)} * 0.7)))`);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const slam = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The lead words rise in one after another, the key words land from larger as they are reached, then the rest follows.
const STAGGER_SEC = 0.08;
const KEY_AT = leadWords.length === 0 ? 0.04 : leadWords.length * STAGGER_SEC + 0.1;
const KEY_SEC = 0.2;
const TRAIL_AT = KEY_AT + 0.24;
tscaps.moment('key', KEY_AT + 0.08, 'The key words land');

const rise = (word, local) => {
  word.style.opacity = String(clamp(local / 0.1));
  word.style.transform = `translateY(${((1 - easeOut(local / 0.3)) * 0.4).toFixed(3)}em)`;
};

tscaps.render = (t) => {
  leadWords.forEach((word, index) => rise(word, t - index * STAGGER_SEC));
  const landed = slam((t - KEY_AT) / KEY_SEC);
  key.style.opacity = String(clamp((t - KEY_AT) / 0.05));
  key.style.transform = `scale(${(1.4 - 0.4 * landed).toFixed(4)})`;
  key.style.filter = `blur(${((1 - landed) * 2).toFixed(2)}vh)`;
  trailWords.forEach((word, index) => rise(word, t - TRAIL_AT - index * STAGGER_SEC));
};
