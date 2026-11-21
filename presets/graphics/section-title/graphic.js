const set = document.querySelector('.set');
const label = document.querySelector('.label');
const title = document.querySelector('.title');
const labelText = String(tscaps.params.label).trim();
const titleText = String(tscaps.params.title).trim().replace(/\s+/g, ' ');
label.textContent = labelText;
label.style.display = labelText === '' ? 'none' : '';
set.style.setProperty('--accent', tscaps.params.accent);
// The label small and tracked out; the title as large as fits, on two rows once it is long.
const titleRows = titleText.length > 16 ? 2 : 1;
set.style.setProperty('--label-size', `max(7vh, min(11vh, calc(80vw / (${Math.max(1, labelText.length)} * 0.9))))`);
set.style.setProperty('--title-size', `max(10vh, min(38vh, calc(88vw * ${titleRows} / (${Math.max(1, titleText.length)} * 0.6))))`);

const words = titleText.split(' ').filter((piece) => piece !== '').map((piece, index) => {
  const word = document.createElement('span');
  word.className = 'word';
  word.textContent = piece;
  if (index > 0) title.append(' ');
  title.append(word);
  return word;
});

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The label tightens in from wide tracking; the title's words land after it from larger, as their blur clears.
const TITLE_AT = labelText === '' ? 0.02 : 0.22;
const STAGGER_SEC = 0.09;
if (titleText !== '') tscaps.moment('title', TITLE_AT + 0.1, 'The title lands');

tscaps.render = (t) => {
  const tightened = easeOut(t / 0.5);
  label.style.opacity = String(clamp(t / 0.15));
  label.style.letterSpacing = `${(0.55 - 0.37 * tightened).toFixed(3)}em`;
  words.forEach((word, index) => {
    const landed = easeOut((t - TITLE_AT - index * STAGGER_SEC) / 0.3);
    word.style.opacity = String(clamp((t - TITLE_AT - index * STAGGER_SEC) / 0.08));
    word.style.transform = `scale(${(1.25 - 0.25 * landed).toFixed(4)})`;
    word.style.filter = `blur(${((1 - landed) * 1.8).toFixed(2)}vh)`;
  });
};
