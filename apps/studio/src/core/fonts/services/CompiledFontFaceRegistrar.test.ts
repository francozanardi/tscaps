import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Document } from '@tscaps/engine';
import { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { CompiledFontFaceRegistrar } from '@core/fonts/services/CompiledFontFaceRegistrar';
import type { SheetFontFacesBuilder } from '@core/fonts/services/SheetFontFacesBuilder';

/**
 * That a derivation which changes no font writes no font rule.
 *
 * Replacing a `<style>` unregisters every face it declared and the
 * browser fetches them again — and a font arriving is itself a reason
 * to re-derive, so rules rebuilt on every derivation do not settle:
 * they fetch, re-derive, fetch again, until the editor is unusable.
 * The rules are cheap to compute and ruinous to rewrite, so what is
 * guarded here is the write, not the build.
 */

class CountingStyleElement {
  written: string[] = [];
  setAttribute(): void {}
  remove(): void {}
  set textContent(value: string) { this.written.push(value); }
}

class FakeHead {
  readonly appended: CountingStyleElement[] = [];
  appendChild(style: CountingStyleElement): void { this.appended.push(style); }
}

let head: FakeHead;
let originalDocument: unknown;

beforeEach(() => {
  head = new FakeHead();
  originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {
    createElement: () => new CountingStyleElement(),
    head,
    fonts: new EventTarget(),
  };
});

afterEach(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

const SHEETS = [{ id: 'main', resolveCss: () => '' } as unknown as Sheet];
const DOCUMENT = { sections: [] } as unknown as Document;

function registrarWriting(rules: () => string): CompiledFontFaceRegistrar {
  return new CompiledFontFaceRegistrar({ build: rules } as unknown as SheetFontFacesBuilder);
}

function reconcileTwice(registrar: CompiledFontFaceRegistrar): void {
  registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
  registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
}

describe('registering the rules a compiled family needs', () => {
  it('writes them once when nothing about the fonts changed', () => {
    reconcileTwice(registrarWriting(() => '@font-face{font-family:\'x\'}'));
    expect(head.appended).toHaveLength(1);
    expect(head.appended[0]!.written).toHaveLength(1);
  });

  it('writes again only when the rules themselves changed', () => {
    let rules = '@font-face{font-family:\'x\'}';
    const registrar = registrarWriting(() => rules);
    registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
    rules = '@font-face{font-family:\'x\';ascent-override:118%}';
    registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
    registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
    expect(head.appended).toHaveLength(1);
    expect(head.appended[0]!.written).toHaveLength(2);
  });

  it('writes nothing at all for sheets that compile to no rules', () => {
    reconcileTwice(registrarWriting(() => ''));
    expect(head.appended).toHaveLength(0);
  });
});


describe('fonts arriving after a text edit', () => {
  it('updates pending metrics when fonts load and settles without repeated writes', () => {
    let loaded = false;
    const registrar = registrarWriting(() => loaded
      ? "@font-face{font-family:'mixed';ascent-override:118%}"
      : "@font-face{font-family:'mixed'}");
    registrar.reconcile(SHEETS, DOCUMENT, ElementStyles.empty());
    loaded = true;
    globalThis.document.fonts.dispatchEvent(new Event('loadingdone'));
    expect(head.appended[0]!.written.at(-1)).toContain('ascent-override:118%');
    globalThis.document.fonts.dispatchEvent(new Event('loadingdone'));
    expect(head.appended[0]!.written).toHaveLength(2);
    registrar.stop();
    loaded = false;
    globalThis.document.fonts.dispatchEvent(new Event('loadingdone'));
    expect(head.appended).toHaveLength(1);
  });
});
