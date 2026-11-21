const set = document.querySelector('.set');
const was = document.querySelector('.was');
const is = document.querySelector('.is');
const wasText = String(tscaps.params.was).trim().replace(/\s+/g, ' ');
const isText = String(tscaps.params.is).trim();
is.textContent = isText;
was.style.display = wasText === '' ? 'none' : '';
is.style.display = isText === '' ? 'none' : '';
set.style.setProperty('--accent', tscaps.params.accent);
set.style.setProperty('--strike', tscaps.params.strike);

// A long first line is set on two rows, broken at the word nearest its middle, each row struck through.
const wasRows = (() => {
  if (wasText.length <= 22) return [wasText];
  const words = wasText.split(' ');
  let best = 1;
  for (let split = 1; split < words.length; split += 1) {
    const gap = Math.abs(words.slice(0, split).join(' ').length - words.slice(split).join(' ').length);
    const bestGap = Math.abs(words.slice(0, best).join(' ').length - words.slice(best).join(' ').length);
    if (gap < bestGap) best = split;
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')].filter((row) => row !== '');
})();
const strikes = wasRows.map((text) => {
  const row = document.createElement('span');
  row.className = 'row';
  row.textContent = text;
  const strike = document.createElement('span');
  strike.className = 'strike';
  row.append(strike);
  was.append(row);
  return strike;
});
// Each line as large as fits the box for its length; the answer always the larger of the two.
const longestRow = Math.max(1, ...wasRows.map((row) => row.length));
set.style.setProperty('--was-size', `max(8vh, min(15vh, calc(90vw / (${longestRow} * 0.56))))`);
set.style.setProperty('--is-size', `min(34vh, calc(90vw / (${Math.max(1, isText.length)} * 0.62)))`);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The answer lands when it is said; the strike sweeps across just before it, row after row.
const ANSWER_AT = Math.max(0.35, Number(tscaps.params.answerAt) || 0.7);
const STRIKE_AT = ANSWER_AT - 0.35;
if (wasText !== '') tscaps.moment('strike', STRIKE_AT, 'The first line is struck through');
if (isText !== '') tscaps.moment('land', ANSWER_AT + 0.08, 'The answer lands');

tscaps.render = (t) => {
  const risen = easeOut(t / 0.3);
  was.style.opacity = String(clamp(t / 0.1));
  was.style.transform = `translateY(${((1 - risen) * 0.4).toFixed(3)}em)`;
  strikes.forEach((strike, index) => {
    strike.style.transform = `scaleX(${easeOut((t - STRIKE_AT - index * 0.08) / 0.25).toFixed(4)})`;
  });
  const landed = easeOut((t - ANSWER_AT) / 0.25);
  is.style.opacity = String(clamp((t - ANSWER_AT) / 0.06));
  is.style.transform = `scale(${(1.3 - 0.3 * landed).toFixed(4)})`;
  is.style.filter = `blur(${((1 - landed) * 1.5).toFixed(2)}vh)`;
};
