const set = document.querySelector('.set');
const mark = document.querySelector('.mark');
const quote = document.querySelector('.quote');
const by = document.querySelector('.by');
const quoteText = String(tscaps.params.quote).trim().replace(/\s+/g, ' ');
const byText = String(tscaps.params.by).trim();
by.textContent = byText === '' ? '' : `— ${byText}`;
by.style.display = byText === '' ? 'none' : '';
set.style.setProperty('--accent', tscaps.params.accent);
// Two balanced rows for a short line, three once it is long; never under a size read on a phone.
const quoteRows = quoteText.length > 40 ? 3 : 2;
set.style.setProperty('--quote-size', `max(9vh, min(22vh, calc(88vw * ${quoteRows} / (${Math.max(1, quoteText.length)} * 0.5))))`);

const words = quoteText.split(' ').filter((piece) => piece !== '').map((piece, index) => {
  const word = document.createElement('span');
  word.className = 'word';
  word.textContent = piece;
  if (index > 0) quote.append(' ');
  quote.append(word);
  return word;
});

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The quotation mark drops in, the words follow one after another, then who said them.
const WORDS_AT = 0.15;
const STAGGER_SEC = 0.06;
const BY_AT = WORDS_AT + words.length * STAGGER_SEC + 0.15;
tscaps.moment('quote', 0.05, 'The quotation mark lands');

tscaps.render = (t) => {
  const dropped = easeOut(t / 0.35);
  mark.style.opacity = String(clamp(t / 0.1));
  mark.style.transform = `translateY(${((1 - dropped) * -0.12).toFixed(3)}em) scale(${(1.3 - 0.3 * dropped).toFixed(4)})`;
  words.forEach((word, index) => {
    const local = t - WORDS_AT - index * STAGGER_SEC;
    word.style.opacity = String(clamp(local / 0.1));
    word.style.transform = `translateY(${((1 - easeOut(local / 0.3)) * 0.35).toFixed(3)}em)`;
  });
  by.style.opacity = String(clamp((t - BY_AT) / 0.25));
};
