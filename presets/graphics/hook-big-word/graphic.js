const stack = document.querySelector('.stack');
const lead = document.querySelector('.lead');
const word = document.querySelector('.word');
const leadText = String(tscaps.params.lead).trim();
const wordText = String(tscaps.params.word).trim();
lead.textContent = leadText;
word.textContent = wordText;
lead.style.display = leadText === '' ? 'none' : '';
stack.style.setProperty('--accent', tscaps.params.accent);
// The lead-in on one row, down to a size still read on a phone; the word as large as fits the width.
stack.style.setProperty('--lead-size', `max(9vh, min(17vh, calc(92vw / (${Math.max(1, leadText.length)} * 0.55))))`);
stack.style.setProperty('--word-size', `min(${leadText === '' ? 70 : 52}vh, calc(92vw / (${Math.max(1, wordText.length)} * 0.7)))`);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The lead-in rises in; the word slams down from larger, hard and fast.
const SLAM = leadText === '' ? 0.05 : 0.3;
const SLAM_SEC = 0.16;
if (wordText !== '') tscaps.moment('slam', SLAM + SLAM_SEC, 'Big word lands');

tscaps.render = (t) => {
  const risen = easeOut(t / 0.3);
  lead.style.opacity = String(clamp(t / 0.15));
  lead.style.transform = `translateY(${(1 - risen) * 3}vh)`;
  const slammed = easeOut((t - SLAM) / SLAM_SEC);
  word.style.opacity = String(clamp((t - SLAM) / 0.05));
  word.style.transform = `scale(${1.45 - 0.45 * slammed})`;
};
