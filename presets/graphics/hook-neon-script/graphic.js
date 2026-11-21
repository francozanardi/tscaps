const set = document.querySelector('.set');
const lead = document.querySelector('.lead');
const big = document.querySelector('.big');
const script = document.querySelector('.script');
lead.textContent = String(tscaps.params.lead).trim();
big.textContent = String(tscaps.params.big).trim();
script.textContent = String(tscaps.params.script).trim();
set.style.setProperty('--accent', tscaps.params.accent);

// Sizes against the big word's, which is 1.
const LEAD_SCALE = 0.2;
const SCRIPT_SCALE = 0.6;
const BIG_LINE = 0.92;
const LEAD_GAP = 0.02;
// The script starts this share of its own width before the big word ends, its middle a little below the big word's
// top, so it crosses the big word's end and stays clear of the lead-in.
const SCRIPT_OVERLAP = 0.42;
const SCRIPT_DROP = 0.22;
const SCRIPT_TILT_DEG = -8;
const MEASURE_SIZE_PX = 100;

// Measures each part at one size, places them against the big word, and scales the whole set to fit the box: a
// longer word makes all of it smaller together, so the parts keep their places.
const layOut = () => {
  const body = getComputedStyle(document.body);
  const roomWidth = document.body.clientWidth - parseFloat(body.paddingLeft) - parseFloat(body.paddingRight);
  const roomHeight = document.body.clientHeight - parseFloat(body.paddingTop) - parseFloat(body.paddingBottom);
  const widthAt = (element, scale) => {
    element.style.fontSize = `${MEASURE_SIZE_PX * scale}px`;
    return element.getBoundingClientRect().width / MEASURE_SIZE_PX;
  };
  const leadWidth = lead.textContent === '' ? 0 : widthAt(lead, LEAD_SCALE);
  const bigWidth = widthAt(big, 1);
  const scriptWidth = script.textContent === '' ? 0 : widthAt(script, SCRIPT_SCALE);

  const leadHeight = lead.textContent === '' ? 0 : LEAD_SCALE + LEAD_GAP;
  const scriptHeight = SCRIPT_SCALE;
  const scriptLeft = bigWidth - scriptWidth * SCRIPT_OVERLAP;
  const scriptTop = leadHeight + SCRIPT_DROP - scriptHeight / 2;
  // Tilted up about its left end, the script's right end rises above where it was set.
  const scriptRise = scriptWidth * Math.sin((-SCRIPT_TILT_DEG * Math.PI) / 180);
  const top = Math.min(0, scriptTop - scriptRise);
  const width = Math.max(leadWidth, bigWidth, scriptLeft + scriptWidth);
  const height = leadHeight + BIG_LINE - top;
  const size = Math.min(roomWidth / width, roomHeight / height);

  set.style.width = `${width * size}px`;
  set.style.height = `${height * size}px`;
  lead.style.fontSize = `${LEAD_SCALE * size}px`;
  lead.style.top = `${-top * size}px`;
  big.style.fontSize = `${size}px`;
  big.style.top = `${(leadHeight - top) * size}px`;
  script.style.fontSize = `${SCRIPT_SCALE * size}px`;
  script.style.left = `${scriptLeft * size}px`;
  script.style.top = `${(scriptTop - top) * size}px`;
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 4);

const SCRIPT_AT = 0.25;
const SCRIPT_SEC = 0.5;
tscaps.moment('script', SCRIPT_AT, 'Script word written');

let laidOut = false;

// The lead-in rises, the big word rises a beat later, then the script is written across it from left to right.
tscaps.render = (t) => {
  if (!laidOut) {
    layOut();
    laidOut = true;
  }
  const leadIn = easeOut(t / 0.35);
  lead.style.opacity = String(leadIn);
  lead.style.transform = `translateY(${(1 - leadIn) * 30}%)`;
  const bigIn = easeOut((t - 0.05) / 0.5);
  big.style.opacity = String(bigIn);
  big.style.transform = `translateY(${(1 - bigIn) * 12}%)`;
  const written = easeOut((t - SCRIPT_AT) / SCRIPT_SEC);
  script.style.opacity = String(clamp((t - SCRIPT_AT) / 0.08));
  script.style.transform = `rotate(${SCRIPT_TILT_DEG}deg)`;
  script.style.clipPath = written < 1 ? `inset(-50% ${(1 - written) * 100}% -50% -10%)` : 'none';
};
