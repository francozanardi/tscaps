const thread = document.querySelector('.thread');
const typing = document.querySelector('.typing');
const message = document.querySelector('.message');
const dots = [...document.querySelectorAll('.dot')];
const photo = document.querySelector('.photo');
thread.style.setProperty('--accent', tscaps.params.accent);
document.querySelector('.name').textContent = tscaps.params.name;
document.querySelector('.initial').textContent = String(tscaps.params.name).trim().charAt(0).toUpperCase();
document.querySelector('.text').textContent = tscaps.params.message;
if (tscaps.params.avatar !== '') {
  photo.src = tscaps.params.avatar;
  photo.style.display = 'block';
}

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);
const ARRIVES = 1.1;
tscaps.moment('arrives', ARRIVES, 'Message arrives');

// Someone is typing for a moment; then the message arrives in place of the dots, and stays.
tscaps.render = (t) => {
  const shown = easeOut(t / 0.45);
  thread.style.opacity = String(clamp(t / 0.2));
  thread.style.transform = `translateY(${(1 - shown) * 10}vh)`;
  const typingNow = t < ARRIVES;
  // The message takes the dots' place: the thread grows upward from where it stands.
  typing.style.display = typingNow ? 'flex' : 'none';
  typing.style.transform = `scale(${0.6 + 0.4 * easeOut((t - 0.1) / 0.35)})`;
  dots.forEach((dot, index) => {
    const wave = Math.sin((t * 1.6 - index * 0.18) * Math.PI * 2);
    dot.style.transform = `translateY(${Math.min(0, wave) * 1.8}vh)`;
    dot.style.opacity = String(0.55 + 0.45 * Math.max(0, -wave));
  });
  const arrived = easeOut((t - ARRIVES) / 0.4);
  message.style.display = typingNow ? 'none' : 'block';
  message.style.transform = `scale(${0.85 + 0.15 * arrived})`;
  message.style.opacity = String(clamp((t - ARRIVES) / 0.12));
};
