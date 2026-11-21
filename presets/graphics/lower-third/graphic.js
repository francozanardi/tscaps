const card = document.querySelector('.card');
document.querySelector('.title').textContent = tscaps.params.title;
document.querySelector('.subtitle').textContent = tscaps.params.subtitle;
card.style.setProperty('--accent', tscaps.params.accent);

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

tscaps.render = (t) => {
  const shown = ease(t / 0.5);
  card.style.transform = `translateX(${(1 - shown) * -110}%)`;
  card.style.opacity = String(shown);
};
