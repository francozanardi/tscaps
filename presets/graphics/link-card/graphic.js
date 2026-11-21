const pill = document.querySelector('.pill');
const icon = document.querySelector('.icon');
const words = document.querySelector('.words');
const label = document.querySelector('.label');
pill.style.setProperty('--accent', tscaps.params.accent);
label.textContent = tscaps.params.label;
label.style.display = String(tscaps.params.label).trim() === '' ? 'none' : '';
// Shown as people type it: no scheme, no trailing slash.
document.querySelector('.url').textContent = String(tscaps.params.url).trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The icon lands first; the pill opens from it and the words slide out after.
tscaps.render = (t) => {
  pill.style.opacity = String(clamp(t / 0.2));
  icon.style.transform = `scale(${0.5 + 0.5 * easeOut(t / 0.4)}) rotate(${(1 - easeOut(t / 0.5)) * -45}deg)`;
  const opened = easeOut((t - 0.15) / 0.5);
  pill.style.clipPath = `inset(0 ${(1 - opened) * 100}% 0 0 round 50vh)`;
  words.style.opacity = String(easeOut((t - 0.3) / 0.4));
  words.style.transform = `translateX(${(1 - easeOut((t - 0.3) / 0.45)) * -6}vh)`;
};
