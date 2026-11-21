const stack = document.querySelector('.stack');
const value = String(tscaps.params.text).trim();
for (const copy of stack.querySelectorAll('.text')) copy.textContent = value;
stack.style.setProperty('--color', tscaps.params.color);
stack.style.setProperty('--outline', tscaps.params.outline);
// Large for a few words, smaller as the text grows, so a sentence or two still fits the box in a few rows.
stack.style.setProperty('--size', `max(7vh, min(15vh, calc(150vh / sqrt(${Math.max(1, value.length)} * 0.9))))`);

const MIN_SIZE_VH = 5;

// Where the text was broken into lines by hand, smaller until each of those lines fits on one row; then smaller still
// while the text is taller than the box, a long line wrapping onto more rows.
const fit = () => {
  const body = getComputedStyle(document.body);
  const roomWidth = document.body.clientWidth - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight);
  const roomHeight = document.body.clientHeight - parseFloat(body.paddingTop) - parseFloat(body.paddingBottom);
  if (value.includes('\n')) {
    const fill = stack.querySelector('.fill');
    fill.style.whiteSpace = 'pre';
    const size = parseFloat(getComputedStyle(stack).fontSize);
    // The text's own extent, not its block's, which is never wider than the box.
    const range = document.createRange();
    range.selectNodeContents(fill);
    const widest = range.getBoundingClientRect().width;
    fill.style.whiteSpace = '';
    const fitting = size * (roomWidth / Math.max(1, widest));
    stack.style.fontSize = `${Math.max((MIN_SIZE_VH * window.innerHeight) / 100, Math.min(size, fitting))}px`;
  }
  for (let step = 0; step < 14 && stack.getBoundingClientRect().height > roomHeight; step += 1) {
    stack.style.fontSize = `${parseFloat(getComputedStyle(stack).fontSize) * 0.92}px`;
  }
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

const LAND_SEC = 0.25;

let fitted = false;

// It shows at once, settling from a touch larger.
tscaps.render = (t) => {
  if (!fitted) {
    fit();
    fitted = true;
  }
  stack.style.opacity = String(clamp(t / 0.08));
  stack.style.transform = `scale(${1.06 - 0.06 * easeOut(t / LAND_SEC)})`;
};
