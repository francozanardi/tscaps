import { describe, expect, it } from 'vitest';
import { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';

const inspector = new CssFootageClockUseInspector();
const timesOnly = (css: string): boolean => inspector.readsClockOnlyToTimeAnimations(css);

describe('a stylesheet that reads the clock only to time its animations', () => {
  it('may never read it', () => {
    expect(timesOnly('.box { left: 10px; animation: slide 1s linear both; } @keyframes slide { from { left: 0; } }')).toBe(true);
  });

  it('reads it as a delay on its own, in `animation` or in `animation-delay`', () => {
    expect(timesOnly('.box { animation: fade 1s linear var(--on-layer-starts) both; }')).toBe(true);
    expect(timesOnly('.box { animation-name: fade; animation-delay: var(--on-layer-starts), var(--on-layer-ends, 0s); }')).toBe(true);
  });

  it('reads it as what a `calc()` adds to or takes from', () => {
    expect(timesOnly('.box { animation: fade 0.3s linear calc(var(--on-layer-ends) - 0.3s) forwards reverse; }')).toBe(true);
    expect(timesOnly('.box { animation: fade 1s calc(var(--on-layer-starts) + min(var(--lag, 0s), 1s)) both; }')).toBe(true);
  });

  it('hands it on through custom properties, however many', () => {
    const css = `
      @layer framework {
        .box { animation: var(--entrance, none), var(--exit, none); }
      }
      [data-el="a"] {
        --ends: var(--on-layer-ends);
        --exit: fade min(var(--exit-length), calc(var(--layer-duration) / 2)) calc(var(--ends) - min(var(--exit-length), 1s)) linear forwards reverse;
        --entrance: rise 0.4s linear(0, 0.2 30%, 1) var(--on-layer-starts) both;
      }
      @keyframes fade { from { opacity: 0; } }
    `;
    expect(timesOnly(css)).toBe(true);
  });

  it('is not put off by a comment, a string or a longer name that only looks like the clock', () => {
    const css = `
      /* opacity: calc(var(--on-layer-starts) / -1s); */
      .box { --on-layer-starts-note: 1; content: "a; b { c"; animation: fade 1s var(--on-layer-starts) both; }
    `;
    expect(timesOnly(css)).toBe(true);
  });
});

describe('a stylesheet that reads the clock anywhere else', () => {
  it('reads it in a property that is not an animation\'s timing', () => {
    expect(timesOnly('.box { opacity: calc(var(--on-layer-starts) / -1s); }')).toBe(false);
    expect(timesOnly('.box { --clip-left: calc(var(--on-layer-starts) / -1s * 100px); }')).toBe(false);
    expect(timesOnly('.box { animation-duration: var(--on-layer-ends); }')).toBe(false);
    expect(timesOnly('@keyframes fade { from { opacity: calc(var(--on-layer-starts) / 1s); } }')).toBe(false);
  });

  it('reads it through a custom property that some other property reads', () => {
    expect(timesOnly('.box { --since: var(--on-layer-starts); rotate: calc(var(--since) / 1s * 10deg); }')).toBe(false);
  });

  it('reads a multiple of it, a bound on it, or takes it away from something', () => {
    expect(timesOnly('.box { animation: fade 1s calc(var(--on-layer-starts) * 2) both; }')).toBe(false);
    expect(timesOnly('.box { animation: fade 1s min(var(--on-layer-starts), 0s) both; }')).toBe(false);
    expect(timesOnly('.box { animation: fade 1s calc(1s - var(--on-layer-starts)) both; }')).toBe(false);
    expect(timesOnly('.box { --delay: var(--on-layer-starts); animation-delay: calc(var(--delay) / 2); }')).toBe(false);
    expect(timesOnly('.box { animation-delay: calc(calc(var(--on-layer-starts) - 1s) - 1s); }')).toBe(false);
  });

  it('sets the clock itself', () => {
    expect(timesOnly('.box { --on-layer-starts: -1s; animation: fade 1s var(--on-layer-starts) both; }')).toBe(false);
  });

  it('names it where no declaration reads it', () => {
    expect(timesOnly('@container style(--on-layer-starts: 0s) { .box { left: 0; } }')).toBe(false);
    expect(timesOnly('.box { --note: --on-layer-ends; }')).toBe(false);
    expect(timesOnly('.box { animation: fade 1s var(--on-layer-starts) both; } @property --on-layer-ends { syntax: "<time>"; inherits: true; initial-value: 0s; }')).toBe(false);
  });
});
