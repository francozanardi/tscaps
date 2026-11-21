const stack = document.querySelector('.stack');
stack.style.setProperty('--color', tscaps.params.color);

// One line of the stack for each line of the text, an empty one left out so it leaves no gap.
const texts = String(tscaps.params.text)
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter((value) => value !== '');
const lines = texts.map((value) => {
  const line = document.createElement('div');
  line.className = 'line';
  const words = document.createElement('span');
  words.className = 'words';
  words.textContent = value;
  line.append(words);
  stack.append(line);
  return { line, words };
});

const MEASURE_SIZE_PX = 100;
// A line of one short word would otherwise fill the box on its own.
const MAX_LINE_HEIGHT_SHARE = 0.42;

// Every line set as wide as the box allows, so its size follows its length; then all of them smaller together while
// the stack is taller than the box, keeping their proportions.
const layOut = () => {
  const body = getComputedStyle(document.body);
  const roomWidth = document.body.clientWidth - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight);
  const roomHeight = document.body.clientHeight - parseFloat(body.paddingTop) - parseFloat(body.paddingBottom);
  const sizes = lines.map(({ words }) => {
    words.style.fontSize = `${MEASURE_SIZE_PX}px`;
    const width = words.getBoundingClientRect().width;
    return Math.min((MEASURE_SIZE_PX * roomWidth * 0.96) / Math.max(1, width), roomHeight * MAX_LINE_HEIGHT_SHARE);
  });
  lines.forEach(({ words }, index) => { words.style.fontSize = `${sizes[index]}px`; });
  const height = stack.getBoundingClientRect().height;
  if (height > roomHeight) {
    const shrink = roomHeight / height;
    lines.forEach(({ words }, index) => { words.style.fontSize = `${sizes[index] * shrink}px`; });
  }
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

const STAGGER_SEC = 0.09;
const RISE_SEC = 0.42;

let laidOut = false;

// Each line rises into its window in turn, from just below its edge.
tscaps.render = (t) => {
  if (!laidOut) {
    layOut();
    laidOut = true;
  }
  lines.forEach(({ line, words }, index) => {
    const risen = easeOut((t - index * STAGGER_SEC) / RISE_SEC);
    words.style.transform = `translateY(${(1 - risen) * 105}%)`;
    line.style.clipPath = risen < 1 ? 'inset(-100vh -100vw 0 -100vw)' : 'none';
  });
};
