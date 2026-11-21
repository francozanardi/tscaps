import { describe, expect, it } from 'vitest';
import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementStyle } from '@core/elements/domain/ElementStyles';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';

/**
 * Whether a field still decides the property it wrote.
 *
 * The whole answer rests on one property of the writer: writing a
 * value the text already carries has to return that text unchanged.
 * Break that and every field reports itself as overruled the moment it
 * is drawn — a panel that greys itself out for no reason, with nothing
 * on screen to explain why. So the identity is pinned first, and the
 * finder's answers after it.
 */

const writer = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
const finder = new CssControlledFieldFinder(writer);

const color: AuthoredElementControl = { id: 'primary-color', label: 'Text', property: 'color', part: 'whole', type: 'color' };
const size: AuthoredElementControl = { id: 'font-size', label: 'Size', property: 'font-size', part: 'whole', type: 'number', unit: '%' };
const underline: AuthoredElementControl = {
  id: 'underline', label: 'Underline', property: 'text-decoration-line', part: 'keyword', type: 'toggle',
  options: [{ value: 'none', label: 'off' }, { value: 'underline', label: 'on' }],
};
const strikethrough: AuthoredElementControl = {
  id: 'strikethrough', label: 'Strikethrough', property: 'text-decoration-line', part: 'keyword', type: 'toggle',
  options: [{ value: 'none', label: 'off' }, { value: 'line-through', label: 'on' }],
};

function styleWith(fields: Record<string, string | number>, css: string): ElementStyle {
  return { kind: 'word', fields, css };
}

describe('writing a value the CSS already carries', () => {
  it('leaves the text exactly as it was', () => {
    const once = writer.write('', color, '#ff0000');
    expect(writer.write(once, color, '#ff0000')).toBe(once);
  });

  it('leaves it alone however many declarations came before', () => {
    let css = writer.write('', color, '#ff0000');
    css = writer.write(css, size, 140);
    expect(writer.write(css, color, '#ff0000')).toBe(css);
    expect(writer.write(css, size, 140)).toBe(css);
  });

  it('leaves it alone when two fields share the one declaration', () => {
    let css = writer.write('', underline, 'underline');
    css = writer.write(css, strikethrough, 'line-through');
    expect(writer.write(css, underline, 'underline')).toBe(css);
    expect(writer.write(css, strikethrough, 'line-through')).toBe(css);
  });
});

describe('finding the fields the CSS has taken over', () => {
  it('reports none while every declaration is the one its field wrote', () => {
    const css = writer.write(writer.write('', color, '#ff0000'), size, 140);
    expect(finder.find(styleWith({ 'primary-color': '#ff0000', 'font-size': 140 }, css), [color, size]).size).toBe(0);
  });

  it('reports the field whose declaration was changed by hand', () => {
    const css = writer.write(writer.write('', color, '#ff0000'), size, 140);
    const edited = css.replace('color: #ff0000;', 'color: var(--brand);');
    const taken = finder.find(styleWith({ 'primary-color': '#ff0000', 'font-size': 140 }, edited), [color, size]);
    expect([...taken]).toEqual(['primary-color']);
  });

  it('reports the field whose declaration was deleted', () => {
    const css = writer.write('', color, '#ff0000');
    expect(finder.find(styleWith({ 'primary-color': '#ff0000' }, ''), [color]).has('primary-color')).toBe(true);
    expect(finder.find(styleWith({ 'primary-color': '#ff0000' }, css), [color]).has('primary-color')).toBe(false);
  });

  // A field that never wrote anything has no declaration to have lost,
  // so the CSS saying something about that property is the template's
  // business rather than a takeover.
  it('says nothing about a field that was never moved', () => {
    expect(finder.find(styleWith({}, 'color: gold;'), [color]).size).toBe(0);
  });

  it('reports only the half of a shared declaration that was touched', () => {
    let css = writer.write('', underline, 'underline');
    css = writer.write(css, strikethrough, 'none');
    const edited = css.replace('text-decoration-line: underline;', 'text-decoration-line: overline;');
    const taken = finder.find(styleWith({ underline: 'underline', strikethrough: 'none' }, edited), [underline, strikethrough]);
    expect(taken.has('underline')).toBe(true);
  });
});
