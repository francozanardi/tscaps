const set = document.querySelector('.set');
const place = document.querySelector('.place');
const detail = document.querySelector('.detail');
const placeText = String(tscaps.params.place).trim();
const detailText = String(tscaps.params.detail).trim();
place.textContent = placeText;
detail.textContent = detailText;
detail.style.display = detailText === '' ? 'none' : '';
set.style.setProperty('--accent', tscaps.params.accent);
// Each on one row, as large as fits the box for its length.
set.style.setProperty('--place-size', `min(${detailText === '' ? 56 : 44}vh, calc(90vw / (${Math.max(1, placeText.length)} * 0.72)))`);
set.style.setProperty('--detail-size', `max(14vh, min(20vh, calc(90vw / (${Math.max(1, detailText.length)} * 0.78))))`);

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The place is uncovered from the left, as if written across; the detail rises in under it.
const REVEAL_SEC = 0.45;
const DETAIL_AT = 0.25;

tscaps.render = (t) => {
  const shown = easeOut(t / REVEAL_SEC) * 100;
  // The clip reaches past the text's box on the three still sides, so its shadow is never cut into a rectangle.
  place.style.clipPath = `inset(-0.6em ${(100 - shown).toFixed(2)}% -0.6em -0.6em)`;
  place.style.opacity = String(clamp(t / 0.06));
  const risen = easeOut((t - DETAIL_AT) / 0.35);
  detail.style.opacity = String(clamp((t - DETAIL_AT) / 0.15));
  detail.style.transform = `translateY(${((1 - risen) * 0.5).toFixed(3)}em)`;
};
