const track = document.querySelector('.track');
const fill = document.querySelector('.fill');
track.style.setProperty('--color', tscaps.params.color);
track.style.setProperty('--track', tscaps.params.track);

// Fills from empty to full over the time the graphic shows.
tscaps.render = (t) => {
  const progress = tscaps.duration > 0 ? Math.min(1, Math.max(0, t / tscaps.duration)) : 1;
  fill.style.transform = `scaleX(${progress})`;
};
