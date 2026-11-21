const bubble = document.querySelector('.bubble');
const photo = document.querySelector('.photo');
const handleText = String(tscaps.params.handle).trim();
const handle = handleText.startsWith('@') || handleText === '' ? handleText : `@${handleText}`;
const comment = String(tscaps.params.comment).trim();
bubble.style.setProperty('--accent', tscaps.params.accent);
document.querySelector('.handle').textContent = handle;
document.querySelector('.initial').textContent = handle.replace(/^@/, '').charAt(0).toUpperCase();
document.querySelector('.comment').textContent = comment;
// One line of about twenty-four characters at full size; a longer comment keeps its area, shrinks and wraps.
bubble.style.setProperty('--size', `${Math.min(16, 16 * Math.sqrt(24 / Math.max(1, comment.length)))}vh`);
if (tscaps.params.avatar !== '') {
  photo.src = tscaps.params.avatar;
  photo.style.display = 'block';
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

// The bubble grows out of its tail, as one said aloud would; then its words settle. No bounce: it is a card.
tscaps.render = (t) => {
  const shown = easeOut(t / 0.4);
  bubble.style.opacity = String(clamp(t / 0.15));
  bubble.style.transformOrigin = '15% 110%';
  bubble.style.transform = `scale(${0.82 + 0.18 * shown})`;
};
