const stack = document.querySelector('.stack');
stack.style.setProperty('--accent', tscaps.params.accent);
stack.style.setProperty('--underline', tscaps.params.underline);
const lineTexts = [tscaps.params.line1, tscaps.params.line2, tscaps.params.line3].map((value) => String(value).trim());
const lines = [...document.querySelectorAll('.line')];
const SVG = 'http://www.w3.org/2000/svg';

/**
 * Wraps the first place `phrase` appears in the lines (any case) in a mark of `kind`, with an SVG holding
 * `passes` strokes; nothing for an empty phrase or one no line holds.
 */
const markPhrase = (phrase, kind, passes) => {
  const needle = phrase.trim().toLowerCase();
  if (needle === '') return null;
  for (const [index, text] of lineTexts.entries()) {
    const at = text.toLowerCase().indexOf(needle);
    if (at === -1 || lines[index].dataset.marked === 'true') continue;
    const mark = document.createElement('span');
    mark.className = `mark ${kind}`;
    mark.textContent = text.slice(at, at + needle.length);
    const svg = document.createElementNS(SVG, 'svg');
    const paths = Array.from({ length: passes }, () => {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('pathLength', '1');
      svg.append(path);
      return path;
    });
    mark.append(svg);
    lines[index].replaceChildren(text.slice(0, at), mark, text.slice(at + needle.length));
    lines[index].dataset.marked = 'true';
    return { svg, paths };
  }
  return null;
};

lines.forEach((line, index) => {
  line.textContent = lineTexts[index];
  line.style.display = lineTexts[index] === '' ? 'none' : '';
  // One row each: full size up to about twelve characters, smaller past that so it still fits the width.
  line.style.setProperty('--size', `min(17vh, calc(88vw / (${Math.max(1, lineTexts[index].length)} * 0.68)))`);
});
const underline = markPhrase(String(tscaps.params.underlined), 'underlined', 2);
const circle = markPhrase(String(tscaps.params.circled), 'circled', 1);

// The hand's wobble, the same every time this graphic is drawn.
let seed = 17;
const wobble = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
};

/** A smooth path through `points` (Catmull-Rom as cubic curves), in the mark's own pixels. */
const pathThrough = (points, width, height) => {
  const at = ([x, y]) => `${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`;
  let d = `M ${at(points[0])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${at(c1)}, ${at(c2)}, ${at(p2)}`;
  }
  return d;
};

/** Two passes under the words, as a quick hand draws them: across, then back a little lower and shorter. */
const underlinePasses = () => {
  const across = Array.from({ length: 7 }, (_, i) => {
    const x = -0.01 + (i / 6) * 1.03;
    return [x, 0.42 + 0.14 * Math.sin(x * 4.2) + wobble() * 0.12];
  });
  const back = Array.from({ length: 6 }, (_, i) => {
    const x = 0.96 - (i / 5) * 0.82;
    return [x, 0.78 + 0.1 * Math.sin(x * 5 + 1) + wobble() * 0.12];
  });
  return [across, back];
};

/** A loop round the words that goes on past where it started, twice and a bit, never quite on its own track. */
const circlePass = () => {
  const points = [];
  const turns = 2.25;
  const steps = 64;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (-1.9 + (i / steps) * turns * 2 * Math.PI);
    const drift = i / steps;
    const rx = 0.47 + 0.035 * Math.sin(angle * 1.7) + wobble() * 0.02 - drift * 0.03;
    const ry = 0.42 + 0.04 * Math.cos(angle * 1.3) + wobble() * 0.03 + drift * 0.03;
    points.push([0.5 + drift * 0.02 + rx * Math.cos(angle), 0.5 - drift * 0.04 + ry * Math.sin(angle)]);
  }
  return [points];
};

/** Lays `strokes` over the mark's own box, once the page has its size and its fonts. */
const drawInto = (mark, strokes) => {
  const { width, height } = mark.svg.getBoundingClientRect();
  mark.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  strokes.forEach((points, index) => mark.paths[index].setAttribute('d', pathThrough(points, width, height)));
};
let laidOut = false;

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);
const easeInOut = (x) => (clamp(x) < 0.5 ? 2 * clamp(x) ** 2 : 1 - (-2 * clamp(x) + 2) ** 2 / 2);

// The marks are drawn once the words are in: the underline's two passes, then the circle.
const UNDERLINE = underline === null ? null : 0.62;
const CIRCLE = circle === null ? null : (UNDERLINE === null ? 0.62 : UNDERLINE + 0.45);
const PASS_SEC = [0.24, 0.16];
// About as long as the marker circle a sound on `circle` brings, so the loop and its sound end together.
const CIRCLE_SEC = 0.6;
if (UNDERLINE !== null) tscaps.moment('underline', UNDERLINE, 'Underline drawn');
if (CIRCLE !== null) tscaps.moment('circle', CIRCLE, 'Circle drawn');

/** How much of a stroke is drawn at `t`, from its start and over its length. */
const drawn = (t, start, length) => easeInOut((t - start) / length);

tscaps.render = (t) => {
  if (!laidOut) {
    if (underline !== null) drawInto(underline, underlinePasses());
    if (circle !== null) drawInto(circle, circlePass());
    laidOut = true;
  }
  lines.forEach((line, index) => {
    const landed = easeOut((t - index * 0.12) / 0.32);
    line.style.opacity = String(clamp((t - index * 0.12) / 0.1));
    line.style.transform = `translateY(${(1 - landed) * 4}vh) scale(${0.9 + 0.1 * landed})`;
  });
  if (underline !== null) {
    underline.paths[0].style.setProperty('--undrawn', String(1 - drawn(t, UNDERLINE, PASS_SEC[0])));
    underline.paths[1].style.setProperty('--undrawn', String(1 - drawn(t, UNDERLINE + PASS_SEC[0] * 0.85, PASS_SEC[1])));
  }
  if (circle !== null) circle.paths[0].style.setProperty('--undrawn', String(1 - drawn(t, CIRCLE, CIRCLE_SEC)));
};
