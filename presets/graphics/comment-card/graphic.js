const card = document.querySelector('.card');
const body = document.querySelector('.body');
const like = document.querySelector('.like');
const photo = document.querySelector('.photo');
card.style.setProperty('--accent', tscaps.params.accent);
const handleText = String(tscaps.params.handle).trim();
document.querySelector('.handle').textContent = handleText.startsWith('@') || handleText === '' ? handleText : `@${handleText}`;
document.querySelector('.when').textContent = tscaps.params.when;
document.querySelector('.initial').textContent = handleText.replace(/^@/, '').charAt(0).toUpperCase();
if (tscaps.params.avatar !== '') {
  photo.src = tscaps.params.avatar;
  photo.style.display = 'block';
}

// The keyword, wherever it sits in the comment, is set apart in the accent colour.
const text = document.querySelector('.text');
const comment = String(tscaps.params.comment);
const keyword = String(tscaps.params.keyword).trim();
const at = keyword === '' ? -1 : comment.toLowerCase().indexOf(keyword.toLowerCase());
if (at === -1) {
  text.textContent = comment;
} else {
  const mark = document.createElement('span');
  mark.className = 'keyword';
  mark.textContent = comment.slice(at, at + keyword.length);
  text.append(comment.slice(0, at), mark, comment.slice(at + keyword.length));
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);
const LIKE = 1.3;
tscaps.moment('like', LIKE, 'Comment liked');

// The card rises in, its words just after; then the heart is liked with one quick pop.
tscaps.render = (t) => {
  const shown = easeOut(t / 0.5);
  card.style.opacity = String(clamp(t / 0.25));
  card.style.transform = `translateY(${(1 - shown) * 18}vh) scale(${0.96 + 0.04 * shown})`;
  const words = easeOut((t - 0.15) / 0.45);
  body.style.opacity = String(words);
  body.style.transform = `translateY(${(1 - words) * 6}vh)`;
  like.classList.toggle('liked', t >= LIKE);
  const pop = t < LIKE ? 0 : Math.sin(clamp((t - LIKE) / 0.28) * Math.PI);
  like.style.transform = `scale(${1 + pop * 0.28})`;
};
