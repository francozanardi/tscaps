const name = document.querySelector('.name');
const role = document.querySelector('.role');
name.textContent = tscaps.params.name;
role.textContent = tscaps.params.role;
role.parentElement.style.display = String(tscaps.params.role).trim() === '' ? 'none' : '';

// Shrinks a line that would not fit the box, once, on the first frame drawn (the box is laid out by then).
const fitWidth = (element) => {
  const room = element.parentElement.clientWidth;
  if (element.scrollWidth > room) element.style.fontSize = `${(parseFloat(getComputedStyle(element).fontSize) * room) / element.scrollWidth}px`;
};
let fitted = false;

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// Each line rises into view from behind its edge; the role follows the name.
tscaps.render = (t) => {
  if (!fitted) { fitWidth(name); fitWidth(role); fitted = true; }
  name.style.transform = `translateY(${(1 - easeOut(t / 0.55)) * 110}%)`;
  role.style.transform = `translateY(${(1 - easeOut((t - 0.12) / 0.55)) * 110}%)`;
};
