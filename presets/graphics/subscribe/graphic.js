const button = document.querySelector('.button');
const label = document.querySelector('.label');
const cursor = document.querySelector('.cursor');
button.style.setProperty('--color', tscaps.params.color);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const CLICK = 1.1;
tscaps.moment('click', CLICK, 'Button clicked');

tscaps.render = (t) => {
  // The button rises in.
  const shown = easeOut(t / 0.4);
  button.style.opacity = String(shown);
  // The cursor glides from the lower right onto the button, presses it, and drifts off.
  const travel = easeOut((t - 0.4) / (CLICK - 0.4));
  const leave = easeOut((t - CLICK - 0.5) / 0.5);
  const x = 88 - travel * 30 + leave * 20;
  const y = 85 - travel * 35 + leave * 25;
  cursor.style.transform = `translate(${x}vw, ${y}vh)`;
  cursor.style.opacity = String(clamp((t - 0.35) / 0.2) * (1 - leave));
  // The press: a quick dip around the click.
  const press = Math.max(0, 1 - Math.abs(t - CLICK) / 0.12);
  button.style.transform = `translateY(${(1 - shown) * 30}vh) scale(${1 - press * 0.08})`;
  const done = t >= CLICK;
  button.classList.toggle('done', done);
  label.textContent = done ? tscaps.params.doneLabel : tscaps.params.label;
};
