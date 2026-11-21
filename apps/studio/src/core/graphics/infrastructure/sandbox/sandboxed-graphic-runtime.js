/*
 * The runtime every graphic runs on, inside its sandboxed frame, ahead of the graphic's own code.
 *
 * It owns time. `requestAnimationFrame`, timers, `performance.now`, `Date`, `Math.random` and CSS and Web
 * Animations answer to a virtual clock that moves only when the editor asks for a frame, stepping one frame
 * at a time and running what was due on the way. So the same frame always shows the same thing, however
 * fast or slow the machine is, and a graphic written as a pure function of time (`tscaps.render(t)`) can be
 * asked any time in any order.
 *
 * It runs the graphic's code, held as text in the page, once the frame's
 * viewport measures the graphic's box and the fonts the page declares have
 * loaded, and says it is ready only after.
 *
 * It answers on the port the editor hands it: `{ type: 'frame', id, frame }` is drawn and sent back, as an
 * `ImageBitmap` of the picture's pixels (the box's size, or fewer where the editor asked for a smaller
 * picture) for a graphic drawn on one canvas (`{ type: 'frame', id, bitmap, usesClock }`), or as the
 * SVG image of its page for the editor to draw (`{ type: 'frame', id, svg, usesClock }`): a picture of a
 * `foreignObject` made here would count as another origin's and could not be handed over. A frame that
 * cannot be drawn is refused (`{ type: 'failed', id, message }`). Each frame also carries `text`: the smallest
 * text the page showed (`{ text, px }`, or null) and the texts it showed cut by the box or by an element that clips
 * them (`cut`).
 * What the graphic logs or throws goes back as `{ type: 'message', level, text }`.
 * Once its code has run it says `{ type: 'ready', moments }`: the moments the code declared with
 * `tscaps.moment(id, sec, label)`, each `{ id, label, sec }`.
 *
 * Read by `SandboxedGraphicPage` as text and written into the frame; never imported.
 */
(() => {
  const config = JSON.parse(document.getElementById('tscaps-graphic-config').textContent);
  const frameMs = 1000 / config.fps;
  // A fixed wall-clock time for the graphic's first frame: `new Date()` is the same in every run.
  const EPOCH_MS = Date.UTC(2026, 0, 1);
  // Room for a timer to schedule more timers inside one frame without the runtime spinning forever.
  const MAX_TIMERS_PER_FRAME = 10000;
  const RealDate = Date;
  // The real timers, kept before the graphic's are put in their place: waiting for the viewport is real time.
  const realSetTimeout = window.setTimeout.bind(window);
  // How long the frame may take to be given its size before the code runs anyway, and how often to look.
  const VIEWPORT_WAIT_MS = 5000;
  const VIEWPORT_POLL_MS = 25;

  let now = 0;
  let ranFrame = -1;
  // Whether the code asked for time to pass: a graphic that did must be replayed from its start to go back.
  let usesClock = false;
  let port = null;
  const pending = [];

  const send = (message, transfer) => {
    if (port === null) pending.push(message);
    else port.postMessage(message, transfer ?? []);
  };
  const say = (level, parts) => send({ type: 'message', level, text: parts.map(describe).join(' ') });
  const describe = (value) => {
    if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  };
  const call = (callback, args) => {
    try { callback(...args); } catch (error) { say('error', [error]); }
  };

  // --- The graphic's view of time and chance -------------------------------------------------------------

  let nextFrameCallbackId = 1;
  let frameCallbacks = new Map();
  window.requestAnimationFrame = (callback) => {
    usesClock = true;
    const id = nextFrameCallbackId++;
    frameCallbacks.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => { frameCallbacks.delete(id); };

  let nextTimerId = 1;
  const timers = new Map();
  const schedule = (callback, delay, args, repeats) => {
    if (typeof callback !== 'function') return 0;
    usesClock = true;
    const id = nextTimerId++;
    const waitMs = Math.max(0, Number(delay) || 0);
    timers.set(id, { dueMs: now + waitMs, callback, args, everyMs: repeats ? Math.max(1, waitMs) : null });
    return id;
  };
  window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) => schedule(callback, delay, args, true);
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };

  performance.now = () => now;
  window.Date = class VirtualDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(EPOCH_MS + now);
      else super(...args);
    }

    static now() {
      return EPOCH_MS + now;
    }
  };

  // mulberry32, from the graphic's own seed.
  let randomState = config.seed >>> 0;
  Math.random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let x = randomState;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  // Every CSS and Web Animation is held still and set to the clock, counted from the frame it first appeared.
  const births = new WeakMap();
  const holdAnimations = () => {
    for (const animation of document.getAnimations()) {
      if (!births.has(animation)) births.set(animation, now);
      animation.pause();
      animation.currentTime = now - births.get(animation);
    }
  };

  // --- Moving the clock -----------------------------------------------------------------------------------

  const runTimersUpTo = (untilMs) => {
    for (let ran = 0; ran < MAX_TIMERS_PER_FRAME; ran += 1) {
      let nextId = null;
      let next = null;
      for (const [id, timer] of timers) {
        if (timer.dueMs > untilMs) continue;
        if (next === null || timer.dueMs < next.dueMs) { nextId = id; next = timer; }
      }
      if (next === null) return;
      now = next.dueMs;
      if (next.everyMs === null) timers.delete(nextId);
      else next.dueMs += next.everyMs;
      call(next.callback, next.args);
    }
    say('warn', ['Too many timers in one frame; the rest wait for the next one.']);
  };

  const runFrameCallbacks = () => {
    const due = frameCallbacks;
    frameCallbacks = new Map();
    for (const callback of due.values()) call(callback, [now]);
  };

  const advanceTo = (frame) => {
    while (ranFrame < frame) {
      ranFrame += 1;
      const frameStartMs = ranFrame * frameMs;
      runTimersUpTo(frameStartMs);
      now = frameStartMs;
      runFrameCallbacks();
      holdAnimations();
    }
    now = frame * frameMs;
  };

  // --- Drawing a frame ------------------------------------------------------------------------------------

  const settle = () => new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });

  const width = config.widthPx;
  const height = config.heightPx;

  // A body holding nothing but one canvas (and the scripts that draw on it) hands that canvas as it is.
  const loneCanvas = () => {
    const elements = [...document.body.children].filter((element) => !(element instanceof HTMLScriptElement));
    return elements.length === 1 && elements[0] instanceof HTMLCanvasElement ? elements[0] : null;
  };

  // The clone of `element` with what the image would lose written into it: a canvas's pixels, and the
  // values its held animations give it now (an SVG image would play them again from their start).
  const freezeInto = (element, clone) => {
    if (element instanceof HTMLCanvasElement) {
      const image = document.createElement('img');
      image.src = element.toDataURL();
      for (const attribute of element.attributes) image.setAttribute(attribute.name, attribute.value);
      clone.replaceWith(image);
      return;
    }
    const animations = element.getAnimations();
    if (animations.length > 0) {
      const computed = getComputedStyle(element);
      for (const animation of animations) {
        for (const keyframe of animation.effect?.getKeyframes?.() ?? []) {
          for (const property of Object.keys(keyframe)) {
            if (property === 'offset' || property === 'easing' || property === 'composite' || property === 'computedOffset') continue;
            const name = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
            clone.style.setProperty(name, computed.getPropertyValue(name));
          }
        }
      }
      clone.style.setProperty('animation', 'none');
      clone.style.setProperty('transition', 'none');
    }
    const children = element.children;
    const cloneChildren = clone.children;
    for (let index = children.length - 1; index >= 0; index -= 1) freezeInto(children[index], cloneChildren[index]);
  };

  const snapshot = () => {
    const clone = document.documentElement.cloneNode(true);
    // Frozen while the clone still matches the page element for element; its scripts go after.
    freezeInto(document.body, clone.querySelector('body'));
    for (const script of clone.querySelectorAll('script, meta')) script.remove();
    // `:root` is the SVG inside an image; the graphic's own root is its `html`.
    for (const style of clone.querySelectorAll('style')) style.textContent = style.textContent.replace(/:root\b/g, 'html');
    const xhtml = new XMLSerializer().serializeToString(clone);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
      + `<foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  };

  // --- Measuring the page's text ---------------------------------------------------------------------------

  // A pixel of slack against rounding, before a text is taken to be cut.
  const CUT_SLACK_PX = 1;
  const MAX_CUT_LISTED = 5;
  const MAX_TEXT_CHARS = 40;
  const shortened = (text) => (text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS - 1)}…` : text);
  // Seen at all: every element up the tree displayed, visible and not fully transparent.
  const shows = (element) => {
    for (let node = element; node !== null; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  // How much a transform scales the element's text: its drawn height over its laid-out one.
  const scaleOf = (element) => {
    const laidOut = element.offsetHeight;
    return laidOut > 0 ? element.getBoundingClientRect().height / laidOut : 1;
  };
  // The box, then every element up the tree that clips what overflows it.
  const clipsOf = (element) => {
    const clips = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }];
    for (let node = element.parentElement; node !== null && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(node.getBoundingClientRect());
    }
    return clips;
  };
  const outside = (rect, clip) => rect.left < clip.left - CUT_SLACK_PX || rect.top < clip.top - CUT_SLACK_PX
    || rect.right > clip.right + CUT_SLACK_PX || rect.bottom > clip.bottom + CUT_SLACK_PX;
  // A text's rect is its line's content area, taller than its letters (more so in a display face set tight): the
  // ink spans from the letters' own ascent to their descent, read from the font, so letters inside the box are not
  // taken for cut because their line is not.
  const measuring = document.createElement('canvas').getContext('2d');
  const inkOf = (rect, style, text, scale) => {
    measuring.font = style.font || `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = measuring.measureText(text);
    const above = Math.max(0, metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent) * scale;
    const below = Math.max(0, metrics.fontBoundingBoxDescent - metrics.actualBoundingBoxDescent) * scale;
    return { left: rect.left, right: rect.right, top: rect.top + above, bottom: rect.bottom - below };
  };
  const measureText = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let smallest = null;
    const cut = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent.trim();
      const element = node.parentElement;
      if (text === '' || element === null || !shows(element)) continue;
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      if (rects.length === 0) continue;
      const style = getComputedStyle(element);
      const scale = scaleOf(element);
      const px = Math.round(parseFloat(style.fontSize) * scale * 10) / 10;
      if (smallest === null || px < smallest.px) smallest = { text: shortened(text), px };
      const clips = clipsOf(element);
      const inks = rects.map((rect) => inkOf(rect, style, text, scale));
      if (inks.some((ink) => clips.some((clip) => outside(ink, clip))) && cut.length < MAX_CUT_LISTED) cut.push(shortened(text));
    }
    return { smallest, cut };
  };

  const draw = async (frame) => {
    advanceTo(frame);
    if (typeof window.tscaps.render === 'function') call(window.tscaps.render, [now / 1000]);
    holdAnimations();
    await settle();
    const text = measureText();
    const canvas = loneCanvas();
    if (canvas !== null) return { bitmap: await createImageBitmap(canvas, { resizeWidth: config.pictureWidthPx, resizeHeight: config.pictureHeightPx }), text };
    return { svg: snapshot(), text };
  };

  // --- Talking to the editor ------------------------------------------------------------------------------

  let queue = Promise.resolve();
  const answer = (request) => {
    if (request?.type !== 'frame') return;
    queue = queue.then(async () => {
      try {
        const picture = await draw(request.frame);
        port.postMessage({ type: 'frame', id: request.id, ...picture, usesClock }, picture.bitmap ? [picture.bitmap] : []);
      } catch (error) {
        port.postMessage({ type: 'failed', id: request.id, message: describe(error) });
      }
    });
  };

  // --- Running the graphic's code ------------------------------------------------------------------------

  // A browser may size a frame only after its page is parsed (Chrome has been seen running a sandboxed frame's
  // scripts at 0 × 0). Code that measures the page then measures nothing, and keeps what it measured, so the
  // graphic's code runs only once the viewport is the box. Under a browser zoom the frame's size is rounded in
  // device pixels and its viewport can land a pixel or two off the box, which is the box all the same.
  const VIEWPORT_SLACK_PX = 2;
  const viewportIsTheBox = () => window.innerWidth > 0 && window.innerHeight > 0
    && Math.abs(window.innerWidth - config.widthPx) <= VIEWPORT_SLACK_PX
    && Math.abs(window.innerHeight - config.heightPx) <= VIEWPORT_SLACK_PX;
  const untilViewportIsTheBox = () => new Promise((resolve) => {
    const startedMs = RealDate.now();
    const look = () => {
      if (viewportIsTheBox()) { resolve(); return; }
      if (RealDate.now() - startedMs >= VIEWPORT_WAIT_MS) {
        say('warn', [`The frame was ${window.innerWidth} × ${window.innerHeight}, not ${config.widthPx} × ${config.heightPx}; the code ran anyway.`]);
        resolve();
        return;
      }
      realSetTimeout(look, VIEWPORT_POLL_MS);
    };
    look();
  });
  const runCode = () => {
    const held = document.getElementById('tscaps-graphic-code');
    if (held === null) return;
    const script = document.createElement('script');
    script.textContent = held.textContent;
    held.remove();
    document.body.append(script);
  };
  const parsed = document.readyState === 'loading'
    ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }))
    : Promise.resolve();
  // Every face the page declares is loaded before the code runs, so a measurement it takes, or a canvas it
  // draws text on, sees the font and not the fallback. They are the fonts the editor handed it, held inline.
  const fontsLoaded = () => Promise.all([...document.fonts].map((face) => face.load().catch(() => undefined)));
  const codeRan = parsed.then(untilViewportIsTheBox).then(fontsLoaded).then(runCode);

  // --- Moments -------------------------------------------------------------------------------------------

  // What the code says happens in it and when, for a sound to be placed on. Declared while the code first
  // runs, so the editor knows them without playing the graphic through.
  const MOMENT_ID = /^[A-Za-z0-9_-]{1,40}$/;
  const moments = new Map();
  let momentsSent = false;
  const moment = (id, sec, label) => {
    if (momentsSent) {
      say('warn', [`tscaps.moment('${id}') was called after the graphic started; declare moments when the code first runs.`]);
      return;
    }
    if (typeof id !== 'string' || !MOMENT_ID.test(id)) {
      say('warn', ['tscaps.moment: the id must be a short name of letters, digits, - or _, such as \'press\'.']);
      return;
    }
    if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) {
      say('warn', [`tscaps.moment('${id}'): give the second it happens, such as tscaps.moment('${id}', 1.3, 'Button pressed').`]);
      return;
    }
    moments.set(id, { id, label: typeof label === 'string' && label.trim() !== '' ? label.trim() : id, sec });
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.type !== 'tscaps-graphic-connect' || port !== null) return;
    port = event.ports[0];
    port.onmessage = (message) => answer(message.data);
    for (const message of pending.splice(0)) port.postMessage(message);
    Promise.all([codeRan, document.fonts.ready]).then(() => {
      holdAnimations();
      momentsSent = true;
      port.postMessage({ type: 'ready', moments: [...moments.values()] });
    });
  });

  for (const level of ['log', 'warn', 'error']) {
    console[level] = (...parts) => say(level, parts);
  }
  window.addEventListener('error', (event) => say('error', [event.error ?? event.message]));
  window.addEventListener('unhandledrejection', (event) => say('error', [event.reason]));

  window.tscaps = {
    params: Object.freeze({ ...config.params }),
    duration: config.durationSec,
    width,
    height,
    render: null,
    moment,
  };
})();
