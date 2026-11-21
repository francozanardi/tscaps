const card = document.querySelector('.card');
const name = document.querySelector('.name');
const handle = document.querySelector('.handle');
const button = document.querySelector('.button');
const label = document.querySelector('.label');
const photo = document.querySelector('.photo');
const avatar = document.querySelector('.avatar');
card.style.setProperty('--accent', tscaps.params.accent);
name.textContent = tscaps.params.name;
const handleText = String(tscaps.params.handle).trim();
handle.textContent = handleText === '' ? '' : handleText.startsWith('@') ? handleText : `@${handleText}`;
handle.style.display = handleText === '' ? 'none' : '';
document.querySelector('.initial').textContent = String(tscaps.params.name).trim().charAt(0).toUpperCase();
if (tscaps.params.avatar !== '') {
  photo.src = tscaps.params.avatar;
  photo.style.display = 'block';
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);
const PRESS = 1.3;
tscaps.moment('press', PRESS, 'Button pressed');

// The card rises in, its avatar and words just after; then the button is pressed and reads as followed.
tscaps.render = (t) => {
  const shown = easeOut(t / 0.5);
  card.style.opacity = String(clamp(t / 0.25));
  card.style.transform = `translateY(${(1 - shown) * 18}vh) scale(${0.96 + 0.04 * shown})`;
  avatar.style.transform = `scale(${0.7 + 0.3 * easeOut((t - 0.08) / 0.45)})`;
  const words = easeOut((t - 0.16) / 0.45);
  name.parentElement.style.opacity = String(words);
  name.parentElement.style.transform = `translateX(${(1 - words) * 8}vh)`;
  // The press: a short dip as the button is tapped, then it reads as followed.
  const press = Math.max(0, 1 - Math.abs(t - PRESS) / 0.1);
  button.style.transform = `scale(${1 - press * 0.07})`;
  const done = t >= PRESS;
  button.classList.toggle('done', done);
  label.textContent = done ? tscaps.params.doneLabel : tscaps.params.label;
};
