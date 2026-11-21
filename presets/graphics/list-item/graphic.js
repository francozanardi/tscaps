const row = document.querySelector('.row');
const number = document.querySelector('.number');
const total = document.querySelector('.total');
const item = document.querySelector('.item');
const numberText = String(tscaps.params.number).trim();
const totalText = String(tscaps.params.total).trim();
const itemText = String(tscaps.params.item).trim().replace(/\s+/g, ' ');
number.textContent = numberText;
total.textContent = totalText === '' ? '' : `/${totalText}`;
item.style.display = itemText === '' ? 'none' : '';
row.style.setProperty('--accent', tscaps.params.accent);
// The number as tall as the box allows; the item on up to two rows beside it, never under a size read on a phone.
row.style.setProperty('--number-size', `min(${itemText === '' ? 80 : 66}vh, calc(30vw / ${Math.max(1, numberText.length) * 0.6}))`);
row.style.setProperty('--item-size', `max(9vh, min(19vh, calc(124vw / (${Math.max(1, itemText.length)} * 0.56))))`);

const words = itemText.split(' ').filter((piece) => piece !== '').map((piece, index) => {
  const word = document.createElement('span');
  word.className = 'word';
  word.textContent = piece;
  if (index > 0) item.append(' ');
  item.append(word);
  return word;
});

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The number lands from larger as its blur clears; then the item's words rise in, one after another.
const LAND_SEC = 0.3;
const ITEM_AT = 0.18;
const STAGGER_SEC = 0.07;
if (numberText !== '') tscaps.moment('land', 0.1, 'The number lands');

tscaps.render = (t) => {
  const landed = easeOut(t / LAND_SEC);
  number.style.opacity = String(clamp(t / 0.08));
  number.style.transform = `scale(${(1.35 - 0.35 * landed).toFixed(4)})`;
  number.style.filter = `blur(${((1 - landed) * 2.5).toFixed(2)}vh)`;
  total.style.opacity = String(clamp((t - 0.15) / 0.2));
  words.forEach((word, index) => {
    const local = t - ITEM_AT - index * STAGGER_SEC;
    word.style.opacity = String(clamp(local / 0.1));
    word.style.transform = `translateY(${((1 - easeOut(local / 0.3)) * 0.4).toFixed(3)}em)`;
  });
};
