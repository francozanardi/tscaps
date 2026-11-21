const block = document.querySelector('.block');
const text = document.querySelector('.text');
const plate = document.querySelector('.plate');
const path = plate.querySelector('path');
block.style.setProperty('--box', tscaps.params.box);
block.style.setProperty('--ink', tscaps.params.ink);

// One line of the box for each line of the text, an empty one left out so it leaves no gap.
const texts = String(tscaps.params.text)
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter((value) => value !== '');
const words = texts.map((value) => {
  const line = document.createElement('span');
  line.className = 'line';
  const inner = document.createElement('span');
  inner.textContent = value;
  line.append(inner);
  text.append(line);
  return inner;
});

const MAX_SIZE_VH = texts.length > 2 ? 14 : 17;
const MIN_SIZE_VH = 8;
const PAD_X_EM = 0.42;
const RADIUS_EM = 0.3;
const PAD_Y_EM = 0.1;
const KAPPA = 0.5523;

// One size for every line, set so the longest fills the width, down to a size still read on a phone; a line too long
// for that wraps onto another row. Then smaller still while the rows are taller than the box.
const layOut = () => {
  const body = getComputedStyle(document.body);
  const roomWidth = document.body.clientWidth - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight);
  const roomHeight = document.body.clientHeight - parseFloat(body.paddingTop) - parseFloat(body.paddingBottom);
  const vh = window.innerHeight / 100;
  text.style.fontSize = `${MAX_SIZE_VH * vh}px`;
  text.style.whiteSpace = 'nowrap';
  const em = parseFloat(getComputedStyle(text).fontSize);
  const widestEm = Math.max(0, ...words.map((inner) => inner.getBoundingClientRect().width)) / em;
  const fitting = roomWidth / (widestEm + 2 * PAD_X_EM);
  text.style.fontSize = `${Math.max(MIN_SIZE_VH * vh, Math.min(MAX_SIZE_VH * vh, fitting))}px`;
  text.style.whiteSpace = '';
  for (let step = 0; step < 12 && text.getBoundingClientRect().height > roomHeight; step += 1) {
    text.style.fontSize = `${parseFloat(getComputedStyle(text).fontSize) * 0.92}px`;
  }
  drawPlate();
};

// Each row of type as it was laid out, one per line a field wraps onto, in the text's own coordinates.
const measureRows = () => {
  const origin = text.getBoundingClientRect();
  const em = parseFloat(getComputedStyle(text).fontSize);
  const padX = em * PAD_X_EM;
  const rects = words.flatMap((inner) => [...inner.getClientRects()]);
  return rects.map((rect) => ({
    left: rect.left - origin.left - padX,
    right: rect.right - origin.left + padX,
    top: rect.top - origin.top,
    bottom: rect.bottom - origin.top,
  }));
};

// Rows that differ in width by less than a corner are made as wide as each other: a step that small reads as a flaw.
const evenOut = (rows, radius) => {
  for (let pass = 0; pass < rows.length; pass += 1) {
    for (let index = 0; index + 1 < rows.length; index += 1) {
      const upper = rows[index];
      const lower = rows[index + 1];
      if (Math.abs((upper.right - upper.left) - (lower.right - lower.left)) < radius * 1.5) {
        const left = Math.min(upper.left, lower.left);
        const right = Math.max(upper.right, lower.right);
        upper.left = lower.left = left;
        upper.right = lower.right = right;
      }
    }
  }
  return rows;
};

// The outline of the joined rows, corner by corner: down the right side, then up the left. Rows touch, meeting halfway
// between one row's type and the next's.
const outline = (rows, padY) => {
  const edges = rows.map((row, index) => (index === 0 ? row.top - padY : (rows[index - 1].bottom + row.top) / 2));
  edges.push(rows[rows.length - 1].bottom + padY);
  const corners = [];
  rows.forEach((row, index) => { corners.push([row.right, edges[index]], [row.right, edges[index + 1]]); });
  for (let index = rows.length - 1; index >= 0; index -= 1) corners.push([rows[index].left, edges[index + 1]], [rows[index].left, edges[index]]);
  return corners.filter((corner, index) => {
    const previous = corners[(index + corners.length - 1) % corners.length];
    const next = corners[(index + 1) % corners.length];
    const collinear = (previous[0] === corner[0] && corner[0] === next[0]) || (previous[1] === corner[1] && corner[1] === next[1]);
    return !collinear;
  });
};

// A closed path through the corners, each rounded by up to `radius`: outwards where the outline turns out, inwards
// where a narrower row meets a wider one.
const roundedPath = (corners, radius) => {
  const toward = (from, to, distance) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [from[0] + ((to[0] - from[0]) / length) * distance, from[1] + ((to[1] - from[1]) / length) * distance];
  };
  const segments = corners.map((corner, index) => {
    const previous = corners[(index + corners.length - 1) % corners.length];
    const next = corners[(index + 1) % corners.length];
    const round = Math.min(radius, Math.hypot(previous[0] - corner[0], previous[1] - corner[1]) / 2, Math.hypot(next[0] - corner[0], next[1] - corner[1]) / 2);
    const start = toward(corner, previous, round);
    const end = toward(corner, next, round);
    const control1 = toward(start, corner, round * KAPPA);
    const control2 = toward(end, corner, round * KAPPA);
    return { start, curve: `C ${control1.join(' ')} ${control2.join(' ')} ${end.join(' ')}` };
  });
  return `M ${segments[0].start.join(' ')} ${segments.map((segment, index) => `${index === 0 ? '' : `L ${segment.start.join(' ')} `}${segment.curve}`).join(' ')} Z`;
};

const drawPlate = () => {
  const em = parseFloat(getComputedStyle(text).fontSize);
  plate.setAttribute('width', String(text.offsetWidth));
  plate.setAttribute('height', String(text.offsetHeight));
  const rows = measureRows();
  if (rows.length === 0) return;
  const radius = em * RADIUS_EM;
  path.setAttribute('d', roundedPath(outline(evenOut(rows, radius), em * PAD_Y_EM), radius));
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

const LAND_SEC = 0.32;

let laidOut = false;

// The text lands as one piece, rising a little from slightly smaller, as a platform's own text pops on.
tscaps.render = (t) => {
  if (!laidOut) {
    layOut();
    laidOut = true;
  }
  const landed = easeOut(t / LAND_SEC);
  block.style.opacity = String(clamp(t / 0.1));
  block.style.transform = `translateY(${(1 - landed) * 4}vh) scale(${0.9 + 0.1 * landed})`;
};
