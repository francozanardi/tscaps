const stack = document.querySelector('.stack');
stack.style.setProperty('--accent', tscaps.params.accent);
const lines = ['top', 'key', 'bottom'].map((name) => {
  const group = document.querySelector(`.line.${name}`);
  const value = String(tscaps.params[name === 'key' ? 'keyword' : name]).trim();
  group.querySelector('textPath').textContent = value;
  group.style.display = value === '' ? 'none' : '';
  return { group, text: group.querySelector('text'), path: document.getElementById(`arc-${name}`) };
});

const clamp = (x) => Math.min(1, Math.max(0, x));
// Out fast, past the mark a little, and back: a swing that settles, not a bounce.
const swing = (x) => {
  const p = clamp(x) - 1;
  const overshoot = 1.9;
  return 1 + (overshoot + 1) * p ** 3 + overshoot * p ** 2;
};

// A line longer than its arc is drawn smaller so it fits; measured once the page has its fonts, on the first frame.
let fitted = false;
const fit = () => {
  for (const { text, path } of lines) {
    const room = path.getTotalLength() * 0.97;
    const length = text.getComputedTextLength();
    if (length > room) text.style.fontSize = `${parseFloat(getComputedStyle(text).fontSize) * (room / length)}px`;
  }
  fitted = true;
};

// Each line swings in from the left on a wide arc, turning about a point far below the stack, overshoots and
// settles; the next one follows before the last has landed.
const PIVOT = '500 1720';
const FROM_DEG = -32;
const LINE_SEC = 0.55;
const STAGGER_SEC = 0.16;
tscaps.moment('keyword', STAGGER_SEC + LINE_SEC * 0.6, 'Key words land');

tscaps.render = (t) => {
  if (!fitted) fit();
  lines.forEach(({ group }, index) => {
    const local = (t - index * STAGGER_SEC) / LINE_SEC;
    group.style.opacity = String(clamp(local * 6));
    group.setAttribute('transform', `rotate(${(FROM_DEG * (1 - swing(local))).toFixed(3)} ${PIVOT})`);
  });
};
