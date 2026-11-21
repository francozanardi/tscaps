const stack = document.querySelector('.stack');
const emoji = document.querySelector('.emoji');
stack.style.setProperty('--accent', tscaps.params.accent);
const emojiText = String(tscaps.params.emoji).trim();
emoji.textContent = emojiText;
emoji.style.display = emojiText === '' ? 'none' : '';

const lineTexts = [tscaps.params.line1, tscaps.params.line2, tscaps.params.line3].map((value) => String(value).trim());
const lines = [...document.querySelectorAll('.line')];
const texts = lines.map((line) => line.querySelector('.text'));
const SQUEEZE = 0.84;
lines.forEach((line, index) => {
  texts[index].textContent = lineTexts[index];
  line.style.display = lineTexts[index] === '' ? 'none' : '';
});

/** Each line on one row, as wide as the box once squeezed, up to a cap so a short line does not tower over the rest. */
const fitLines = () => {
  const room = document.body.clientWidth * 0.9 / SQUEEZE;
  const cap = window.innerHeight * 0.19;
  for (const [index, line] of lines.entries()) {
    line.style.setProperty('--size', '100px');
    const width = texts[index].getBoundingClientRect().width;
    line.style.setProperty('--size', `${Math.min(cap, (100 * room) / Math.max(1, width))}px`);
  }
};

// The highlighted words in the accent: the first place they appear in the lines, any case.
let accent = null;
const needle = String(tscaps.params.highlight).trim().toLowerCase();
for (const [index, text] of lineTexts.entries()) {
  const at = needle === '' ? -1 : text.toLowerCase().indexOf(needle);
  if (at === -1) continue;
  accent = document.createElement('span');
  accent.className = 'accent';
  accent.textContent = text.slice(at, at + needle.length);
  texts[index].replaceChildren(text.slice(0, at), accent, text.slice(at + needle.length));
  break;
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOutBack = (x, overshoot) => {
  const p = clamp(x) - 1;
  return 1 + (overshoot + 1) * p * p * p + overshoot * p * p;
};

// The emoji pops up from nothing with a twist, then keeps bobbing; the lines punch in after it, one by one,
// and the highlighted words kick once the last one lands.
const POP_SEC = 0.38;
const LINE_START = emojiText === '' ? 0.05 : 0.22;
const LINE_SEC = 0.24;
const STAGGER = 0.11;
const shown = lines.filter((_, index) => lineTexts[index] !== '');
const KICK = LINE_START + Math.max(0, shown.length - 1) * STAGGER + LINE_SEC;
const KICK_SEC = 0.3;
if (emojiText !== '') tscaps.moment('pop', 0.04, 'Emoji pops in');
if (accent !== null) tscaps.moment('kick', KICK, 'Highlight kicks');

let fitted = false;
tscaps.render = (t) => {
  if (!fitted) {
    fitLines();
    fitted = true;
  }
  const popped = easeOutBack(t / POP_SEC, 2.6);
  const settled = clamp((t - POP_SEC) / 0.4);
  const bob = Math.sin((t - POP_SEC) * Math.PI * 1.6) * settled;
  emoji.style.opacity = String(clamp(t / 0.06));
  emoji.style.transform = `translateY(${bob * -1.2}vh) rotate(${(1 - popped) * -28 + bob * 4}deg) scale(${popped})`;
  shown.forEach((line, index) => {
    const start = LINE_START + index * STAGGER;
    const landed = easeOutBack((t - start) / LINE_SEC, 1.8);
    line.style.opacity = String(clamp((t - start) / 0.05));
    line.style.transform = `scale(${(1.1 - 0.1 * landed) * SQUEEZE}, ${1.1 - 0.1 * landed})`;
  });
  if (accent !== null) {
    const kicked = clamp((t - KICK) / KICK_SEC);
    // A hop rather than a swell, so the words never grow over the space beside them.
    const hop = Math.sin(kicked * Math.PI);
    accent.style.transform = `translateY(${hop * -0.14}em) scale(${1 + hop * 0.04})`;
  }
};
