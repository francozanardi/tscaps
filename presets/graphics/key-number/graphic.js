const set = document.querySelector('.set');
const number = document.querySelector('.number');
const label = document.querySelector('.label');
const numberText = String(tscaps.params.number).trim();
const labelText = String(tscaps.params.label).trim();
number.textContent = numberText;
label.textContent = labelText;
label.style.display = labelText === '' ? 'none' : '';
set.style.setProperty('--accent', tscaps.params.accent);
// The number as large as the box allows for its length; the label on one or two rows, never under a size read on a phone.
set.style.setProperty('--number-size', `min(${labelText === '' ? 72 : 56}vh, calc(90vw / (${Math.max(1, numberText.length)} * 0.62)))`);
set.style.setProperty('--label-size', `max(7vh, min(11vh, calc(180vw / (${Math.max(1, labelText.length)} * 0.78))))`);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The number lands from larger, its blur clearing as it settles; the label rises in once the number has landed.
const LAND_SEC = 0.32;
const LABEL_AT = 0.18;
if (numberText !== '') tscaps.moment('land', 0.12, 'The number lands');

tscaps.render = (t) => {
  const landed = easeOut(t / LAND_SEC);
  number.style.opacity = String(clamp(t / 0.08));
  number.style.transform = `scale(${1.35 - 0.35 * landed})`;
  number.style.filter = `blur(${((1 - landed) * 2.5).toFixed(2)}vh)`;
  const risen = easeOut((t - LABEL_AT) / 0.35);
  label.style.opacity = String(clamp((t - LABEL_AT) / 0.15));
  label.style.transform = `translateY(${((1 - risen) * 0.6).toFixed(3)}em)`;
};
