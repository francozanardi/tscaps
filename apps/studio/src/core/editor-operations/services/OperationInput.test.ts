import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OperationInput } from '@core/editor-operations/services/OperationInput';

const input = new OperationInput({
  shot: z.string(),
  graphic: z.object({ html: z.string(), box: z.object({ width: z.number() }).optional() }).optional(),
  tags: z.array(z.string()).optional(),
});

describe('OperationInput', () => {
  it('reads an object or a list sent as a JSON string, as language models now and then send one', () => {
    const checked = input.check({ shot: 'shot:1', graphic: '{"html":"<b>Hi</b>","box":{"width":0.8}}', tags: '["a","b"]' });

    expect(checked).toEqual({ ok: true, value: { shot: 'shot:1', graphic: { html: '<b>Hi</b>', box: { width: 0.8 } }, tags: ['a', 'b'] } });
  });

  it('reads a nested object sent as a JSON string inside a real object', () => {
    const checked = input.check({ shot: 'shot:1', graphic: { html: 'x', box: '{"width":0.5}' } });

    expect(checked.ok && checked.value.graphic?.box).toEqual({ width: 0.5 });
  });

  it('lets go of the stray closing brace a model writes after a nested object sent as a string', () => {
    const checked = input.check({ shot: 'shot:1', graphic: '{"html":"<b>{x}</b>","box":{"width":0.7}}}' });

    expect(checked.ok && checked.value.graphic).toEqual({ html: '<b>{x}</b>', box: { width: 0.7 } });
  });

  it('still refuses a string that is not JSON, or JSON of the wrong kind, naming the field', () => {
    for (const graphic of ['<b>Hi</b>', '["a"]', '{"html":"x"} trailing']) {
      const checked = input.check({ shot: 'shot:1', graphic });

      expect(checked.ok).toBe(false);
      expect(checked.ok ? '' : checked.problems[0]?.message).toMatch(/^graphic: /);
    }
  });

  it('never reads a string field as JSON', () => {
    expect(input.check({ shot: '{"id":1}' })).toEqual({ ok: true, value: { shot: '{"id":1}' } });
  });
});
